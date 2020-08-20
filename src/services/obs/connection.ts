import { ResultAsync, okAsync } from 'neverthrow';
import ObsWebSocket, {
  ObsError,
  RequestMethodsArgsMap,
  RequestMethodReturnMap,
} from 'obs-websocket-js';
import pLimit from 'p-limit';

import { getLogger } from '@util/logger';
import { sleep } from '@util/async';
import { getConfig } from '@util/configuration/config';

const logger = getLogger('services/obs/connection');
const MIN_RECONNECTION_DELAY = 3 * 1000;
const MAX_RECONNECTION_DELAY = 5 * 60 * 1000;
const RECONNECTION_DELAY_GROWTH = 2;
const MAX_RECONNECTION_ATTEMPTS = 25;

type ResolveType<T> = T extends PromiseLike<infer U> ? U : T;

export interface ObsConnection {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Returns ResultAsync isntead of Promise
  send<K extends keyof RequestMethodsArgsMap>(
    requestType: K,
    ...args: RequestMethodsArgsMap[K] extends object
      ? [RequestMethodsArgsMap[K]]
      : [undefined?]
  ): ResultAsync<RequestMethodReturnMap[K], Error>;

  on: ObsWebSocket['on'];
  off: ObsWebSocket['off'];
  once: ObsWebSocket['once'];
}

export class ObsConnectionImpl implements ObsConnection {
  private readonly ws: ObsWebSocket;
  private readonly connectionQueue = pLimit(1);
  private connected = false;

  public readonly on: ObsConnection['on'];
  public readonly off: ObsConnection['off'];
  public readonly once: ObsConnection['once'];

  public constructor(ws: ObsWebSocket) {
    this.ws = ws;
    this.on = ws.on.bind(ws);
    this.off = ws.off.bind(ws);
    this.once = ws.once.bind(ws);

    this.on('ConnectionOpened', () => {
      this.connected = true;
      this.ws.once('ConnectionClosed', this.handleDisconnect);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.on('error' as any, logger.error);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public readonly send: ObsConnection['send'] = (requestType, ...args) => {
    const connection: ResultAsync<void, Error> = this.connected ?
      okAsync(undefined) :
      this.reconnect();
    return connection.andThen(() => {
      return ResultAsync.fromPromise(
        this.ws.send(requestType, ...args),
        obsError => new Error(`${requestType} failed: ${(obsError as ObsError).error}`),
      );
    });
  };

  public readonly connect: ObsConnection['connect'] = async () => {
    return this.connectInternal(MAX_RECONNECTION_ATTEMPTS);
  };

  private reconnect(): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      this.connectInternal(1),
      error => error as Error,
    );
  }

  private async connectInternal(maxAttempts: number): Promise<void> {
    let delay = MIN_RECONNECTION_DELAY;
    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0) {
        await sleep(delay);
        delay = Math.min(MAX_RECONNECTION_DELAY, delay * RECONNECTION_DELAY_GROWTH);
      }
      const obsConfig = getConfig().obs;
      try {
        await this.connectionQueue(async () => {
          if (this.connected) {
            return;
          }
          logger.debug(`Connection attempt ${i + 1}/${maxAttempts}`);
          await this.ws.connect(obsConfig);
          logger.info(`Connected to OBS at ${obsConfig.address}`);
        });
        return;
      } catch(error) {
        if (this.connected) {
          logger.warn('Error thrown, but we\'re connected');
          return;
        }
        logger.debug(`Unable to connect to ${obsConfig.address}: ${(error as ObsError).error}`);
      }
    }
    logger.warn('Hit maximum number of OBS connection attempts');
    throw new Error('Unable to connect to OBS');
  };

  private readonly handleDisconnect = () => {
    this.connected = false;
    logger.warn('Lost connection to OBS');
    this.connect();
  };

  public readonly disconnect = () => {
    this.ws.off('ConnectionClosed', this.handleDisconnect);
    this.ws.disconnect();
    logger.info('Disconnected from OBS');
  };
}
