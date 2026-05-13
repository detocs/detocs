import { promises as fs } from 'fs';

import { getConfig } from '@util/configuration/config.ts';
import { getLogger } from '@util/logger.ts';

import Game from './game.ts';

type ParsedGame = Partial<Omit<Game, 'id' | 'name'>> &
Required<Pick<Game, 'id' | 'name'>>;

const logger = getLogger('games');
let games: Game[] = [];

export interface GameDatabase {
  getGames(): Game[];
  getGameById(id: string): Game | null;
  getGameByServiceId(serviceName: string, id: string): Game | null;
}

export async function loadGameDatabase(): Promise<void> {
  games = [];
  const filePath = getConfig().gameDatabaseFile;
  if (!filePath) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
  } catch (error) {
    logger.error(`Unable to load games from ${filePath}: ${error}`);
    return;
  }
  if (!(parsed instanceof Array)) {
    logger.error('Game list must be an array');
    return;
  }

  logger.info(`Loading game database from ${filePath}.
game count: ${parsed.length}`);
  for (const x of parsed) {
    if (typeof x !== 'object') {
      logger.error(`${x} is not an object`);
      return;
    }

    if (typeof x.id !== 'string' || typeof x.name !== 'string') {
      logger.error('id/name missing from object:', x);
      return;
    }
  }
  const parsedGames = parsed as ParsedGame[];

  games = parsedGames.map(game => ({
    ...game,
    shortNames: game.shortNames || [],
    hashtags: game.hashtags || [],
    serviceInfo: game.serviceInfo || {},
  }));
}

export function getGames(): Game[] {
  return games;
}

export function getGameById(id: string): Game | null {
  return games.find(g => g.id === id) || null;
}

export function getGameByServiceId(
  serviceName: string,
  id: string,
): Game | null {
  return games.find(g => g.serviceInfo[serviceName]?.id === id) || null;
}
