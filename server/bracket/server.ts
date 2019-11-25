import log4js from 'log4js';
const logger = log4js.getLogger('server/bracket');
logger.error = logger.error.bind(logger);

import express, { Request, Response } from 'express';
import updateImmutable from 'immutability-helper';
import * as ws from 'ws';

import State, { nullState } from './state';
import SmashggClient, { parseTournamentSlug } from '../../util/smashgg';
import { appWebsocketServer } from '../../util/http';
import { SmashggId } from '../../models/smashgg';

type WebSocketClient = ws;

interface UpdateRequest {
  tournamentUrl?: string;
  tournamentSlug?: string;
  eventId?: string;
  phaseId?: string;
}


export default function start(port: number): void {
  logger.info('Initializing bracket server');

  const smashgg = new SmashggClient();
  const { appServer, socketServer } = appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  const server = new BracketServer(appServer, socketServer, smashgg);
  server.registerHandlers();
};

class BracketServer {
  private readonly appServer: express.Express;
  private readonly socketServer: ws.Server;
  private readonly smashgg: SmashggClient;
  private state: State = nullState;
  private refreshTimer: NodeJS.Timeout | null = null;

  public constructor(
    appServer: express.Express,
    socketServer: ws.Server,
    smasggClient: SmashggClient,
  ) {
    this.appServer = appServer;
    this.socketServer = socketServer;
    this.smashgg = smasggClient;
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
    const tournamentUrl = fields.tournamentUrl || null;
    const tournamentSlug = fields.tournamentSlug || null;
    const update: Partial<State> = {
      tournamentId: tournamentUrl ? parseTournamentSlug(tournamentUrl) : tournamentSlug,
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

    // Asynchronous operations
    if (update.tournamentId && tournamentChanged) {
      this.smashgg.phasesForTournament(update.tournamentId)
        .then(updates => {
          this.selectSingletonEvent(updates);
          this.selectSingletonPhase(updates);
          this.state = updateImmutable(this.state, { $merge: updates });
          this.broadcastState();
        })
        .catch(logger.error);
    }
    if (update.phaseId && phaseChanged) {
      this.fetchSets(update.phaseId)
        .then(() => {
          if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
          }
          this.refreshTimer = setInterval(this.refreshSets, 60 * 1000);
        });
    }

    update.eventId = update.eventId || null;
    update.phaseId = update.phaseId || null;
    this.state = updateImmutable(this.state, { $merge: update });
    res.sendStatus(200);
    this.broadcastState();
  };

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

  private fetchSets(phaseId: SmashggId): Promise<void> {
    logger.debug(`Fetching sets for phase ${phaseId}`);
    return this.smashgg.upcomingSetsByPhase(phaseId)
      .then(unfinishedSets => {
        this.state = updateImmutable(this.state, { $merge: { unfinishedSets } });
        this.broadcastState();
      })
      .catch(logger.error);
  }

  private refreshSets = async (): Promise<void> => {
    if (!this.state.phaseId) {
      return;
    }
    await this.fetchSets(this.state.phaseId);
  };
}

function sendUserError(res: express.Response, msg: string): void {
  logger.warn(msg);
  res.status(400).send(msg);
}

function emptyToNull(str: string | undefined): string | null | undefined {
  if (str === '') {
    return null;
  }
  return str;
}
