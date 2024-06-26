import { ResultAsync, okAsync } from 'neverthrow';
import ObsWebSocket, {
  OBSRequestTypes,
  OBSResponseTypes,
  OBSWebSocketError,
  RequestBatchOptions,
  RequestBatchRequest,
  ResponseMessage,
} from 'obs-websocket-js';
import pLimit from 'p-limit';

import { getLogger } from '@util/logger';
import { sleep } from '@util/async';
import { Config } from '@util/configuration/config';
import { fromThrowable } from '@util/results';

const logger = getLogger('services/obs/connection');
const MIN_RECONNECTION_DELAY = 5 * 1000;
const MAX_RECONNECTION_DELAY = 5 * 60 * 1000;
const RECONNECTION_DELAY_GROWTH = 5;
const MAX_RECONNECTION_ATTEMPTS = 3;
const ERR_NOT_READY = 207;
const ERR_AUTHENTICATION_FAILED = 4009;

export interface ObsConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Returns ResultAsync isntead of Promise
  call<K extends keyof OBSRequestTypes>(
    requestType: K,
    requestData?: OBSRequestTypes[K],
  ): ResultAsync<OBSResponseTypes[K], Error>;
  callBatch(
    requests: RequestBatchRequest[],
    options?: RequestBatchOptions,
  ): ResultAsync<ResponseMessage[], Error>;

  on: ObsWebSocket['on'];
  off: ObsWebSocket['off'];
  once: ObsWebSocket['once'];
}

export class ObsConnectionImpl implements ObsConnection {
  private readonly ws: ObsWebSocket;
  private readonly config: Config['obs'];
  private readonly connectionQueue = pLimit(1);

  public readonly on: ObsConnection['on'];
  public readonly off: ObsConnection['off'];
  public readonly once: ObsConnection['once'];

  public constructor(ws: ObsWebSocket, config: Config['obs']) {
    this.ws = ws;
    this.config = config;
    this.on = ws.on.bind(ws);
    this.off = ws.off.bind(ws);
    this.once = ws.once.bind(ws);

    this.on('Identified', () => {
      this.ws.once('ConnectionClosed', this.handleDisconnect);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.on('error' as any, logger.error);
  }

  public isConnected(): boolean {
    return this.ws.identified;
  }

  public readonly call: ObsConnection['call'] = (requestType, ...args) => {
    const connection: ResultAsync<void, Error> = this.ws.identified ?
      okAsync(undefined) :
      this.reconnect();
    const sendRequest = () => this.ws.call(requestType, ...args);
    return connection.andThen(handleNotReady(requestType, sendRequest));
  };

  public readonly callBatch: ObsConnection['callBatch'] = (requests, options) => {
    const connection: ResultAsync<void, Error> = this.ws.identified ?
      okAsync(undefined) :
      this.reconnect();
    const sendRequest = () => this.ws.callBatch(requests, options);
    return connection.andThen(handleNotReady('Batch request', sendRequest));
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
      const address = ensureProtocol(this.config.address);
      try {
        await this.connectionQueue(async () => {
          if (this.ws.identified) {
            return;
          }
          logger.debug(`Connection attempt ${i + 1}/${maxAttempts}`);
          await this.ws.connect(
            address,
            this.config.password,
          );
          logger.info(`Connected to OBS at ${address}`);
        });
        return;
      } catch(error) {
        if ((error as OBSWebSocketError).code == ERR_AUTHENTICATION_FAILED) {
          throw new Error(`Unable to connect to ${address}: ${(error as OBSWebSocketError).message}`);
        }
        if (this.ws.identified) {
          logger.warn(`Error thrown, but we\'re connected? ${error}`);
          return;
        }
        logger.debug(`Unable to connect to ${address}: ${error}`);
      }
    }
    logger.warn('Hit maximum number of OBS connection attempts');
    throw new Error('Unable to connect to OBS');
  }

  private readonly handleDisconnect = (): void => {
    logger.warn('Lost connection to OBS');
    this.connect();
  };

  public readonly disconnect = (): Promise<void> => {
    this.ws.off('ConnectionClosed', this.handleDisconnect);
    return this.ws.disconnect()
      .then(() => {
        logger.info('Disconnected from OBS');
      });
  };
}

function handleNotReady<T>(requestType: string, sendRequest: () => Promise<T>): (() => ResultAsync<T, Error>) {
  return fromThrowable(async () => {
    let obsError = null;
    let resp = null;
    do {
      if (obsError) {
        logger.warn('OBS is not ready for requests. Waiting 1s before re-attempting request...');
        obsError = null;
        await sleep(1000);
      }
      try {
        resp = await sendRequest();
        return resp;
      } catch (e) {
        obsError = e;
      }
    } while (obsError instanceof OBSWebSocketError && obsError.code == ERR_NOT_READY);

    logger.error(obsError);
    logger.error(typeof obsError);
    throw new Error(`${requestType} failed: ${obsError}`);
  });
}

function ensureProtocol(address: string): string {
  if (address.startsWith('ws://') || address.startsWith('wss://')) {
    return address;
  }
  return 'ws://' + address;
}

