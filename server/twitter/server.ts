import { Express, RequestHandler } from 'express';
import updateImmutable from 'immutability-helper';
import * as ws from 'ws';

import { MediaServer } from '@server/media/server';
import TwitterClient from '@services/twitter/twitter';
import { getCredentials } from '@util/configuration/credentials';
import * as httpUtil from '@util/http-server';
import { getLogger } from '@util/logger';

import { nullState } from './client-state';

const logger = getLogger('server/twitter');

interface InternalState {
  apiKey: string | null;
  apiKeySecret: string | null;
  accessToken: {
    key: string;
    secret: string;
  } | null;
}

interface TweetRequest {
  body?: string;
  media?: string;
  thread?: 'on' | '';
}

type WebSocketClient = ws;

const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

export default async function start(port: number, mediaServer: MediaServer): Promise<void> {
  logger.info('Initializing Twitter server');

  const { twitterKey, twitterSecret } = getCredentials();
  if (!twitterKey || !twitterSecret) {
    logger.warn('Twitter API keys not found');
    return;
  }
  const twitterClient = new TwitterClient(twitterKey, twitterSecret);
  const accessToken = getCredentials().twitterToken;
  if (accessToken) {
    // TODO: Handle revoked tokens
    logger.info('Already logged in');
    // TODO: Be more tolerant of lack of network connection
    await twitterClient.logIn(accessToken);
  }

  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  new TwitterServer(appServer, socketServer, twitterClient, mediaServer, port);
};

class TwitterServer {
  private readonly appServer: Express;
  private readonly socketServer: ws.Server;
  private readonly twitterClient: TwitterClient;
  private readonly media: MediaServer;
  private readonly port: number;
  private state = updateImmutable(nullState, {
    hasCredentials: { $set: true },
  });

  public constructor(
    appServer: Express,
    socketServer: ws.Server,
    twitterClient: TwitterClient,
    mediaServer: MediaServer,
    port: number,
  ) {
    this.appServer = appServer;
    this.socketServer = socketServer;
    this.twitterClient = twitterClient;
    this.media = mediaServer;
    this.port = port;
    this.registerHandlers();
    this.twitterClient.onLogin(user => {
      this.state = updateImmutable(
        this.state,
        {
          user: { $set: user },
          lastTweetId: { $set: null },
        },
      );
      this.broadcastState();
    });
  }

  private registerHandlers(): void {
    this.appServer.get('/login', async (_, res): Promise<void> => {
      res.redirect(await this.twitterClient.getAuthorizeUrl(this.port));
    });
    this.appServer.get('/authorize', async (req, res): Promise<unknown> => {
      return this.twitterClient.authorize(req.query)
        .then(() => res.send(`Authentication successful!<br>You can close this window.`))
        .catch(sendServerError.bind(null, res));
    });
    this.appServer.post('/tweet', this.tweet);

    this.socketServer.on('connection', (client): void => {
      logger.info('Websocket connection received');
      this.sendState(client as WebSocketClient);
    });
  }

  private broadcastState = (): void => {
    this.socketServer.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        this.sendState(client as WebSocketClient);
      }
    });
  };

  private sendState(client: WebSocketClient): void {
    client.send(JSON.stringify(this.state));
  }

  private tweet: RequestHandler = async (req, res) => {
    if (!this.twitterClient.isLoggedIn()) {
      sendUserError(res, 'Twitter client not logged in');
      return;
    }

    const { body, media: mediaUrl, thread } = req.fields as TweetRequest;
    if (!body && !mediaUrl) {
      sendUserError(res, 'Body or media is required');
      return;
    }
    const mediaPath = mediaUrl && this.media.getPathFromUrl(mediaUrl);
    const replyTo = !!thread && this.state.lastTweetId ?
      this.state.lastTweetId :
      null;

    try {
      const tweetId = await this.twitterClient.tweet(body || '', replyTo, mediaPath);
      logger.info(`Created tweet ${tweetId}${replyTo ? ` as a reply to ${replyTo}` : ''}`);
      this.state = updateImmutable(
        this.state,
        { lastTweetId: { $set: tweetId } }
      );
      res.sendStatus(200);
      this.broadcastState();
    } catch (err) {
      sendServerError(res, err);
      return;
    }
  };
}
