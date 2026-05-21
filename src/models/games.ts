import { Error as ChainableError } from 'chainable-error';
import { promises as fs } from 'fs';
import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';

import Game from '@models/game.ts';
import { getConfig } from '@util/configuration/config.ts';
import { Watcher, watchFile } from '@util/fs.ts';
import { getLogger } from '@util/logger.ts';

type ParsedGame = Partial<Omit<Game, 'id' | 'name'>> &
Required<Pick<Game, 'id' | 'name'>>;

const logger = getLogger('games');

export interface GameDatabase {
  getGames(): Game[];
  getGameById(id: string): Game | null;
  getGameByServiceId(serviceName: string, id: string): Game | null;
}

export function loadGameDatabase(): ResultAsync<GameDatabase, Error> {
  const db = new GameDatabaseImpl();
  const gameDatabaseFile = getConfig().gameDatabaseFile;
  if (!gameDatabaseFile) {
    logger.warn('No game database file specified');
    return okAsync(db);
  }
  return db.parseAndWatch(gameDatabaseFile).map(() => db);
}

export function emptyGameDatabase(): GameDatabase {
  return new GameDatabaseImpl();
}

class GameDatabaseImpl implements GameDatabase {
  private games: Game[] = [];
  private watcher: Watcher = { close: () => {/* ignore */} };

  public parseAndWatch(filePath: string): ResultAsync<void, Error> {
    if (this.watcher) {
      this.watcher.close();
    }
    this.watcher = watchFile(filePath,
      () => {
        logger.info(`Game database file ${filePath} changed, reloading...`);
        this.parse(filePath).match(
          () => { /* noop */ },
          logger.error,
        );
      },
      logger.error,
    );
    return this.parse(filePath);
  }

  public parse(filePath: string): ResultAsync<void, Error> {
    logger.info(`Loading game database from ${filePath}`);
    return loadDatabase(filePath)
      .map(games => {
        logger.info(`Games loaded. Game count: ${games.length}`);
        this.setGames(games);
      });
  }

  setGames(games: Game[]): void {
    this.games = games;
  }

  getGames(): Game[] {
    return this.games;
  }

  getGameById(id: string): Game | null {
    return this.games.find(g => g.id === id) || null;
  }

  getGameByServiceId(
    serviceName: string,
    id: string,
  ): Game | null {
    return this.games.find(g => g.serviceInfo[serviceName]?.id === id) || null;
  }
}

function loadDatabase(filePath: string): ResultAsync<Game[], Error> {
  if (!filePath) {
    return errAsync(new Error('No game database file path specified'));
  }

  return ResultAsync.fromPromise(
    fs.readFile(filePath, { encoding: 'utf8' }).then(JSON.parse),
    e => new ChainableError(`Unable to load games from ${filePath}`, e as Error),
  )
    .andThen(parsed => {
      if (!(parsed instanceof Array)) {
        return err(new Error('Game list must be an array'));
      }

      for (const x of parsed) {
        if (typeof x !== 'object') {
          return err(new Error(`${x} is not an object`));
        }

        if (typeof x.id !== 'string' || typeof x.name !== 'string') {
          return err(new Error(`id/name missing from object: ${x}`));
        }
      }

      const parsedGames = parsed as ParsedGame[];
      const games = parsedGames.map(game => ({
        ...game,
        shortNames: game.shortNames || [],
        hashtags: game.hashtags || [],
        serviceInfo: game.serviceInfo || {},
      }));
      return ok(games);
    });
}
