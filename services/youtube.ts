import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import http from 'http';
import { Result, ok, err } from 'neverthrow';
import open from 'open';
import url from 'url';

import { getCredentials, saveCredentials } from '@util/configuration/credentials';
import { getLogger } from '@util/logger';

const logger = getLogger('services/youtube');
export const MAX_TITLE_SIZE = 100;
export const MAX_DESCRIPTION_SIZE = 5000;
export const MAX_TAGS_SIZE = 500;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtubepartner',
];

export async function getYoutubeAuthClient(): Promise<Result<OAuth2Client, Error>> {
  const {
    googleKey: clientId,
    googleSecret: clientSecret,
    youtubeToken,
  } = getCredentials();
  let auth: OAuth2Client | undefined;

  if (!clientId || !clientSecret) {
    return err(new Error('Google API app credentials missing'));
  }

  if (!youtubeToken) {
    logger.info('YouTube credentials not found, performing OAuth authorization');
    auth = await completePkceFlow(clientId, clientSecret);
    getCredentials().youtubeToken = auth.credentials;
    saveCredentials();
  } else {
    logger.info('YouTube access token found', youtubeToken);
    // TODO: Do I need to refresh tokens manually?
    auth = new google.auth.OAuth2({ clientId, clientSecret });
    auth.setCredentials(youtubeToken);
  }
  await printChannelInfo(auth);
  return ok(auth);
}

async function completePkceFlow(clientId: string, clientSecret: string): Promise<OAuth2Client> {
  const promise = new Promise<OAuth2Client>((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, async () => {
      const address = server.address();
      if (typeof address == 'string' || address == null) {
        throw new Error(`Wasn't expecting server.address() to be ${address}`);
      }
      const redirectUri = `http://localhost:${address.port}`;
      const oAuth2Client = new google.auth.OAuth2({ clientId, clientSecret, redirectUri });
      const codes = await oAuth2Client.generateCodeVerifierAsync();
      const authorizeUrl = oAuth2Client.generateAuthUrl({
        'access_type': 'offline',
        'scope': SCOPES,
        'code_challenge_method': CodeChallengeMethod.S256,
        'code_challenge': codes.codeChallenge,
      });
      server.addListener('request', async (req: http.IncomingMessage, res: http.ServerResponse) => {
        try {
          if (!req.url) {
            return;
          }
          const queryString = new url.URL(req.url, redirectUri).searchParams;
          const code = queryString.get('code');
          if (!code) {
            return;
          }
          logger.debug(`Code is ${code}`);
          res.end('Authentication successful!');
          server.close();

          const r = await oAuth2Client.getToken({
            code,
            codeVerifier: codes.codeVerifier,
          });
          oAuth2Client.setCredentials(r.tokens);
          logger.info('YouTube access token acquired');
          resolve(oAuth2Client);
        }
        catch (e) {
          reject(e);
        }
      });
      open(authorizeUrl, { wait: false }).then(cp => cp.unref());
    });
  });
  return promise;
}

async function printChannelInfo(auth: OAuth2Client): Promise<void> {
  return new Promise((resolve, reject) => {
    google.youtube('v3').channels.list({
      auth,
      part: 'snippet',
      mine: true,
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      var channels = response?.data.items;
      if (!channels || channels.length === 0) {
        reject(new Error('No YouTube channel found'));
        return;
      }
      const title = channels[0].snippet?.title;
      const id = channels[0].id;
      logger.info(`Logged in as: ${title} (${id})`);
      resolve();
    });
  });
}

export function titleSize(title: string): number {
  return title.length;
}

export function descriptionSize(desc: string): number {
  return Buffer.byteLength(desc);
}

export function tagsSize(tags: string[]): number {
  const characterCount = tags
    .map(t => t.includes(' ') || t.includes(',') ? t.length + 2 : t.length)
    .reduce((acc, curr) => acc + curr);
  const commas = Math.max(tags.length - 1, 0);
  return characterCount + commas;
}
