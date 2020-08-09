import { getLogger } from '@util/logger';

import { Error as ChainableError } from 'chainable-error';
import express, { Request, Response } from 'express';
import updateImmutable from 'immutability-helper';
import * as ws from 'ws';

import BracketService from '@services/bracket-service';
import BracketServiceProvider from '@services/bracket-service-provider';
import { parseTournamentId as parseChallongeId } from '@services/challonge/challonge';
import { CHALLONGE_SERVICE_NAME } from '@services/challonge/constants';
import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';
import { parseTournamentSlug as parseSmashggSlug } from '@services/smashgg/smashgg';
import * as httpUtil from '@util/http-server';

import State, { nullState } from './state';

type WebSocketClient = ws;

interface UpdateRequest {
  tournamentUrl?: string;
  tournamentId?: string;
  eventId?: string;
  phaseId?: string;
}

const logger = getLogger('server/bracket');
const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

export default function start({ port, bracketProvider }: {
  port: number;
  bracketProvider: BracketServiceProvider;
}): void {
  logger.info('Initializing bracket server');

  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  const server = new BracketServer(appServer, socketServer, bracketProvider);
  server.registerHandlers();
};

class BracketServer {
  private readonly appServer: express.Express;
  private readonly socketServer: ws.Server;
  private readonly bracketProvider: BracketServiceProvider;
  private bracketService: BracketService | null;
  private state: State = nullState;
  private refreshTimer: NodeJS.Timeout | null = null;

  public constructor(
    appServer: express.Express,
    socketServer: ws.Server,
    bracketProvider: BracketServiceProvider,
  ) {
    this.appServer = appServer;
    this.socketServer = socketServer;
    this.bracketProvider = bracketProvider;
    this.bracketService = null;
  }

  public registerHandlers(): void {
    this.appServer.post('/update', this.updateEndpoint);
    this.appServer.get('/state', (req, res) => {
      res.send(this.state);
    });

    this.socketServer.on('connection', (client): void => {
      logger.info('Websocket connection received');
      this.sendState(client as WebSocketClient);
    });
  }

  private broadcastState(): void {
    this.socketServer.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        this.sendState(client as WebSocketClient);
      }
    });
  }

  private sendState(client: WebSocketClient): void {
    client.send(JSON.stringify(this.state));
  }

  private updateEndpoint = async (req: Request, res: Response): Promise<void> => {
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const fields = req.fields as UpdateRequest;
    const tourneyUrlOrSlug = fields.tournamentUrl || null;
    const tourneyId = fields.tournamentId || null;
    const [ parsedTournamentId, bracketService ] = this.parseUrlOrSlug(tourneyUrlOrSlug);
    this.bracketService = bracketService;
    const update: Partial<State> = {
      tournamentId: parsedTournamentId || tourneyId,
      eventId: emptyToNull(fields.eventId),
      phaseId: emptyToNull(fields.phaseId),
    };

    // If an ID is unset/changed, then clear the fields that depend on it
    let tournamentChanged = update.tournamentId != this.state.tournamentId;
    let eventChanged = update.eventId != this.state.eventId;
    let phaseChanged = update.phaseId != this.state.phaseId;
    if (!update.tournamentId || tournamentChanged) {
      update.tournament = null;
      update.eventId = undefined;
      update.events = [];
      update.phases = [];
    }
    if (!update.eventId || eventChanged) {
      update.phaseId = undefined;
    }
    if (!update.phaseId || phaseChanged) {
      update.unfinishedSets = [];
      this.stopSetRefresh();
    }

    this.selectSingletonPhase(update);

    tournamentChanged = update.tournamentId != this.state.tournamentId;
    eventChanged = update.eventId != this.state.eventId;
    phaseChanged = update.phaseId != this.state.phaseId;

    // Validate options
    if (
      update.eventId &&
      eventChanged &&
      this.state.events.length &&
      !this.state.events.some(e => e.id === update.eventId)
    ) {
      sendUserError(res, 'Invalid event ID');
      return;
    }
    if (
      update.phaseId &&
      phaseChanged &&
      this.state.phases.length &&
      !this.state.phases.some(p => p.id === update.phaseId)
    ) {
      sendUserError(res, 'Invalid phase ID');
      return;
    }

    update.eventId = update.eventId || null;
    update.phaseId = update.phaseId || null;
    this.state = updateImmutable(this.state, { $merge: update });
    this.broadcastState();

    if (update.tournamentId && tournamentChanged && this.bracketService) {
      try {
        const updates = await this.bracketService.phasesForTournament(update.tournamentId);
        this.selectSingletonEvent(updates);
        this.selectSingletonPhase(updates);
        this.state = updateImmutable(this.state, { $merge: updates });
        this.broadcastState();
      } catch (err) {
        // TODO: Distinguish between 404 and other errors
        err = new ChainableError(`Unable to find tournament ${update.tournamentId}`, err);
        this.state = nullState;
        this.broadcastState();
        sendUserError(res, err);
        return;
      }
    }

    // Asynchronous operations
    if (update.phaseId && phaseChanged) {
      this.fetchSets(update.phaseId)
        .then(this.startSetRefresh);
    }

    res.sendStatus(200);
  };

  private parseUrlOrSlug(
    tourneyUrlOrSlug: string | null
  ): [ string | null, BracketService | null ] {
    if (!tourneyUrlOrSlug) {
      return [ null, this.bracketService ];
    }
    const smashgg = parseSmashggSlug(tourneyUrlOrSlug);
    if (smashgg) {
      return [ smashgg, this.bracketProvider.get(SMASHGG_SERVICE_NAME)];
    }
    const challonge = parseChallongeId(tourneyUrlOrSlug);
    if (challonge) {
      return [ challonge, this.bracketProvider.get(CHALLONGE_SERVICE_NAME)];
    }
    return [ tourneyUrlOrSlug, this.bracketProvider.get(SMASHGG_SERVICE_NAME)];
  }

  private selectSingletonPhase(update: Partial<State>): void {
    if (update.eventId && update.phaseId === undefined) {
      const eventPhases = this.state.phases.filter(p => p.eventId === update.eventId);
      if (eventPhases.length === 1) {
        update.phaseId = eventPhases[0].id;
      }
    }
  }

  private selectSingletonEvent(update: Partial<State>): void {
    if (update.tournamentId && update.eventId === undefined) {
      if (this.state.events.length === 1) {
        update.eventId = this.state.events[0].id;
      }
    }
  }

  private async fetchSets(phaseId: string): Promise<void> {
    if (!this.bracketService) {
      return;
    }
    logger.debug(`Fetching sets for phase ${phaseId}`);
    return this.bracketService.upcomingSetsByPhase(phaseId)
      .then(unfinishedSets => {
        this.state = updateImmutable(this.state, { $merge: { unfinishedSets } });
        this.broadcastState();
      })
      .catch(logger.error);
  }

  private startSetRefresh = (): void => {
    this.stopSetRefresh();
    this.refreshTimer = setInterval(this.refreshSets, 60 * 1000);
  };

  private stopSetRefresh = (): void => {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  };

  private refreshSets = async (): Promise<void> => {
    if (!this.state.phaseId) {
      return;
    }
    await this.fetchSets(this.state.phaseId);
  };
}

function emptyToNull(str: string | undefined): string | null | undefined {
  if (str === '') {
    return null;
  }
  return str;
}
