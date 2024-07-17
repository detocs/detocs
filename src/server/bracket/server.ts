import { Error as ChainableError } from 'chainable-error';
import express, { Request, Response } from 'express';
import updateImmutable from 'immutability-helper';
import { err, ok, Result, ResultAsync } from 'neverthrow';
import * as ws from 'ws';

import BracketService from '@services/bracket-service';
import BracketServiceProvider from '@services/bracket-service-provider';
import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';
import * as httpUtil from '@util/http-server';
import { getLogger } from '@util/logger';
import { parseFormData } from '@util/parsing';
import { nonEmpty } from '@util/predicates';

import State, { nullState } from './state';
import isEqual from 'lodash.isequal';

type WebSocketClient = ws;

type StateWithUnsettableFields = Omit<State, 'eventId' | 'phaseId' | 'phaseGroupIds'> & Partial<State>;

interface UpdateRequest {
  tournamentUrl?: string;
  tournamentId?: string;
  eventId?: string;
  phaseId?: string;
  phaseGroupIds?: string[];
}

const logger = getLogger('server/bracket');

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
}

class BracketServer {
  private readonly appServer: express.Express;
  private readonly socketServer: ws.Server;
  private readonly bracketProvider: BracketServiceProvider;
  private bracketService: BracketService | null;
  private state: Readonly<State> = nullState;
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
    this.appServer.post('/update', this.updateEndpoint.bind(this));
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

  private async updateEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.update(req.fields);
      result.match(
        code => {res.sendStatus(code)},
        e => e.send(logger, res),
      );
    } catch(e) {
      httpUtil.sendServerError(logger, res, e as Error);
    }
  }

  private async update(
    rawFields?: Request['fields'],
  ): Promise<Result<number, httpUtil.HttpError>> {
    if (!rawFields) {
      return ok(400);
    }
    const fields = parseFormData(rawFields) as UpdateRequest;
    const [ parsedTournamentSlug, bracketService ] = this.parseUrlOrSlug(fields.tournamentUrl || null);
    this.bracketService = bracketService;
    const parsedIds = {
      tournamentId: emptyToNull(fields.tournamentId),
      eventId: emptyToNull(fields.eventId),
      phaseId: emptyToNull(fields.phaseId),
      phaseGroupIds: fields.phaseGroupIds?.filter(nonEmpty),
    };

    // Validate options
    const currentPhaseGroupsSet = new Set(this.state.phaseGroups.map(pg => pg.id));
    if (
      parsedIds.eventId &&
      !this.state.events.some(e => e.id === parsedIds.eventId)
    ) {
      return err(httpUtil.userError('Invalid event ID'));
    }
    if (
      parsedIds.phaseId &&
      !this.state.phases.some(p => p.id === parsedIds.phaseId)
    ) {
      return err(httpUtil.userError('Invalid phase ID'));
    }
    if (
      parsedIds.phaseGroupIds &&
      parsedIds.phaseGroupIds.some(id => !currentPhaseGroupsSet.has(id))
    ) {
      return err(httpUtil.userError('Invalid pool ID'));
    }

    const originalTournamentId = this.state.tournamentId;
    const originalEventId = this.state.eventId;
    const originalPhaseGroupIds = new Set(this.state.phaseGroupIds);

    this.state = this.applyUpdate(parsedIds, parsedTournamentSlug);
    this.broadcastState();

    if (this.bracketService && parsedTournamentSlug) {
      const [newState, error] = await fetchTournament(this.bracketService, parsedTournamentSlug)
        .match(
          update => {
            return [update, null as httpUtil.HttpError | null];
          },
          e => {
            return [nullState, httpUtil.userError(e)];
          }
        );

      this.state = newState;
      this.broadcastState();
      if (error) {
        return err(error);
      }
    }

    if (this.bracketService && this.state.tournamentId && this.state.eventId && this.state.eventId !== originalEventId) {
      const [update, error] = await fetchEventPhases(this.bracketService, this.state.tournamentId, this.state.eventId)
        .match(
          update => {
            return [update, null as httpUtil.HttpError | null];
          },
          e => {
            return [nullState, httpUtil.userError(e)];
          }
        );
      this.state = updateImmutable(this.state, { $merge: update });
      this.broadcastState();
      if (error) {
        return err(error);
      }
    }

    if (!isEqual(new Set(this.state.phaseGroupIds), originalPhaseGroupIds)) {
      // Asynchronousy fetch sets
      if (this.state.phaseGroupIds.length) {
        this.fetchSets(this.state)
          .then(requestWasValid => requestWasValid && this.startSetRefresh());
      } else {
        this.stopSetRefresh();
      }
    }

    return ok(200);
  }

  private parseUrlOrSlug(
    tourneyUrlOrSlug: string | null
  ): [ string | null, BracketService | null ] {
    if (!tourneyUrlOrSlug) {
      return [ null, this.bracketService ];
    }
    const parsed = this.bracketProvider.parse(tourneyUrlOrSlug);
    if (parsed) {
      return [ parsed.parsedIds.tournamentId, this.bracketProvider.get(parsed.serviceName) ];
    }
    // Default to smashgg for now
    return [ tourneyUrlOrSlug, this.bracketProvider.get(SMASHGG_SERVICE_NAME)];
  }

  private applyUpdate(parsedIds: Partial<State>, parsedSlug: string | null): State {
    // We're using undefined vs null to differentiate between fields that have
    // been unset by the server or the user
    const update: StateWithUnsettableFields = Object.assign(
      {},
      this.state,
      parsedIds,
    );

    this.clearDependentFields(update, parsedSlug);

    selectSingletonEvent(update);
    selectSingletonPhase(update);
    selectSingletonPhaseGroup(update);

    update.eventId = update.eventId || null;
    update.phaseId = update.phaseId || null;
    update.phaseGroupIds = update.phaseGroupIds || [];
    return update as State;
  }

  // If an ID is unset/changed, then clear the fields that depend on it
  private clearDependentFields(update: Partial<State>, parsedSlug: string | null): void {
    const tournamentChanged = update.tournamentId != this.state.tournamentId;
    const eventChanged = update.eventId != this.state.eventId;
    const phaseChanged = update.phaseId != this.state.phaseId;
    const phaseGroupsChanged = !isEqual(new Set(update.phaseGroupIds), new Set(this.state.phaseGroupIds));
    if (parsedSlug) {
      update.tournamentId = undefined;
      update.tournament = null;
    }
    if (!update.tournamentId || tournamentChanged) {
      update.eventId = undefined;
      update.events = [];
      update.phases = [];
      update.phaseGroups = [];
    }
    if (!update.eventId || eventChanged) {
      update.phaseId = undefined;
    }
    if (!update.phaseId || phaseChanged) {
      update.phaseGroupIds = [];
    }
    if (!update.phaseGroupIds || !update.phaseGroupIds.length || phaseGroupsChanged) {
      update.unfinishedSets = [];
    }
  }

  private async fetchSets({
    phaseId,
    phaseGroupIds,
  }: Pick<Partial<State>, 'phaseId' | 'phaseGroupIds'>): Promise<boolean> {
    if (!this.bracketService) {
      return false;
    }
    if (phaseId == null) {
      return false;
    }
    if (!phaseGroupIds || !phaseGroupIds.length) {
      return false;
    }
    logger.debug(`Fetching sets for phase ${phaseId}, pools: [${phaseGroupIds}], from ${this.bracketService.name()}`);
    return this.bracketService.upcomingSetsByPhaseGroup(phaseId, phaseGroupIds)
      .then(unfinishedSets => {
        if (unfinishedSets.length == 0) {
          throw new Error('Fetched set list is empty');
        }
        this.state = updateImmutable(this.state, { $merge: { unfinishedSets } });
        this.broadcastState();
        return true;
      })
      .catch(err => {logger.error(err); return true});
  }

  private startSetRefresh = (): void => {
    this.stopSetRefresh();
    this.refreshTimer = setInterval(this.refreshSets, 2 * 60 * 1000);
  };

  private stopSetRefresh = (): void => {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  };

  private refreshSets = async (): Promise<void> => {
    await this.fetchSets(this.state);
  };
}

function fetchTournament(
  bracketService: BracketService,
  tournamentSlug: string,
): ResultAsync<State, Error> {
  logger.debug(`Fetching tournament ${tournamentSlug}, from ${bracketService.name()}`);
  return ResultAsync.fromPromise(
    bracketService.eventsForTournament(tournamentSlug)
      .then(resp => ({
          tournament: resp.tournament,
          tournamentId: resp.tournament.id,
          events: resp.events,
          eventId: resp.events.length === 1 ? resp.events[0].id : null,
          phases: [],
          phaseId: null,
          phaseGroups: [],
          phaseGroupIds: [],
          unfinishedSets: [],
      })),
    // TODO: Distinguish between 404 and other errors
    e => new ChainableError(`Unable to load tournament ${tournamentSlug}`, e as Error)
  );
}

function fetchEventPhases(
  bracketService: BracketService,
  tournamentId: string,
  eventId: string,
): ResultAsync<Pick<State, 'phases'|'phaseId'|'phaseGroups'|'phaseGroupIds'>, Error> {
  logger.debug(`Fetching phases for event ${eventId}, tournament ${tournamentId}, from ${bracketService.name()}`);
  return ResultAsync.fromPromise(
    bracketService.phasesForEvent(tournamentId, eventId)
      .then(resp => {
        const update = {
          eventId: eventId,
          phases: resp.phases,
          phaseId: undefined,
          phaseGroups: resp.phaseGroups,
          phaseGroupIds: [],
        };
        selectSingletonPhase(update);
        selectSingletonPhaseGroup(update);
        return {
          eventId: update.eventId,
          phases: update.phases,
          phaseId: update.phaseId || null,
          phaseGroups: update.phaseGroups,
          phaseGroupIds: update.phaseGroupIds || [],
        };
      }),
    // TODO: Distinguish between 404 and other errors
    e => new ChainableError(`Unable to load event ${eventId}`, e as Error)
  );
}

function selectSingletonPhaseGroup(update: Partial<State>): void {
  if (update.phaseId && !update.phaseGroupIds?.length && update.phaseGroups) {
    const pools = update.phaseGroups.filter(p => p.phaseId === update.phaseId);
    if (pools.length === 1) {
      update.phaseGroupIds = [pools[0].id];
    }
  }
}

function selectSingletonPhase(update: Partial<State>): void {
  if (update.eventId && update.phaseId === undefined && update.phases) {
    const eventPhases = update.phases.filter(p => p.eventId === update.eventId);
    if (eventPhases.length === 1) {
      update.phaseId = eventPhases[0].id;
    }
  }
}

function selectSingletonEvent(update: Partial<State>): void {
  if (update.eventId === undefined && update.events?.length === 1) {
    update.eventId = update.events[0].id;
  }
}

function emptyToNull(str: string | undefined): string | null | undefined {
  if (str === '') {
    return null;
  }
  return str;
}
