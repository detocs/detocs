import log4js from 'log4js';
const logger = log4js.getLogger('server/twitter');
logger.error = logger.error.bind(logger);

import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import fs from 'fs';
import { createServer } from 'http';
import Twit from 'twit';
import * as ws from 'ws';

import { AccessToken } from '../../models/twitter';
import { sleep } from '../../util/async';
import { getCredentials, saveCredentials } from '../../util/credentials';
import * as twitter from '../../util/twitter';

import ClientState from './client-state';
import TwitterOAuth from './oauth';

interface InternalState {
  apiKey: string | null;
  apiKeySecret: string | null;
  accessToken: {
    key: string;
    secret: string;
  } | null;
}

const clientState: ClientState = {
  loggedIn: false,
  authorizeUrl: null,
  user: null,
};
const internalState: InternalState = {
  apiKey: null,
  apiKeySecret: null,
  accessToken: null,
};
let socketServer: ws.Server | null = null;
let twit: Twit | null = null;

export default async function start(port: number): Promise<void> {
  logger.info('Initializing Twitter server');

  await loadApiKeys();
  if (!internalState.apiKey || !internalState.apiKeySecret) {
    logger.warn('Twitter API keys not found');
    return;
  }

  const oauth = new TwitterOAuth(
    internalState.apiKey,
    internalState.apiKeySecret,
    async accessToken => {
      getCredentials().twitterAccessToken = accessToken; // setCredentials?
      saveCredentials();
      await logIn(accessToken);
      broadcastState(clientState);
    },
  );
  const accessToken = getCredentials().twitterAccessToken;
  if (accessToken) {
    // TODO: Handle revoked tokens
    logger.info('Already logged in');
    await logIn(accessToken);
  }
  clientState.authorizeUrl =  await oauth.getAuthorizeUrl('http://localhost:58588/authorize');
  broadcastState(clientState);

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/authorize', async (req: express.Request, res: express.Response): Promise<void> => {
    const params: Record<string, string> = req.query;
    res.send(await oauth.authorize(params));
  });

  const httpServer = createServer(app);
  socketServer = new ws.Server({
    server: httpServer,
  });
  socketServer.on('connection', function connection(client): void {
    client.send(JSON.stringify(clientState));
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
};

function broadcastState(state: ClientState): void {
  console.log('Broadcasting state: ', state);
  if (!socketServer) {
    return;
  }
  logger.debug('Broadcasting state: ', state);
  socketServer.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify(state));
    }
  });
}

async function loadApiKeys(): Promise<void> {
  internalState.apiKey = fs.readFileSync('TWITTER_API_KEY', 'utf8').trim();
  internalState.apiKeySecret = fs.readFileSync('TWITTER_API_KEY_SECRET', 'utf8').trim();
}

async function logIn(accessToken: AccessToken): Promise<void> {
  if (!internalState.apiKey || !internalState.apiKeySecret) {
    throw new Error('Tried to log in without API key');
  }
  twit = initTwitClient(internalState.apiKey, internalState.apiKeySecret, accessToken);
  clientState.loggedIn = true;
  clientState.user = await twitter.getUser(twit);
}

function initTwitClient(apiKey: string, apiKeySecret: string, accessToken: AccessToken): Twit {
  return new Twit({
    'consumer_key': apiKey,
    'consumer_secret': apiKeySecret,
    'access_token': accessToken.key,
    'access_token_secret': accessToken.secret,
  });
}
