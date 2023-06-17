import { youtube } from '@google/youtube';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import http from 'http';
import { Result, ok, err, ResultAsync } from 'neverthrow';
import open from 'open';
import url from 'url';

import { getCredentials, saveCredentials } from '@util/configuration/credentials';
import { getLogger } from '@util/logger';
import { youtube_v3 } from '@google/youtube/v3';

export type SanitizedTitle = string & { readonly __tag: unique symbol };
export type SanitizedDescription = SanitizedTitle;
export type SanitizedTag = string & { readonly __tag: unique symbol };

const logger = getLogger('services/youtube');
export const MAX_TITLE_SIZE = 100;
export const MAX_DESCRIPTION_SIZE = 5000;
export const MAX_TAGS_SIZE = 500;
export const GAMING_CATEGORY_ID = '20';
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
    auth = new OAuth2Client({ clientId, clientSecret });
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
      const oAuth2Client = new OAuth2Client({ clientId, clientSecret, redirectUri });
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
    youtube('v3').channels.list({
      auth,
      part: [ 'snippet' ],
      mine: true,
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      const channels = response?.data.items;
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

export function getVideoById(
  auth: OAuth2Client,
  id: string,
): ResultAsync<youtube_v3.Schema$Video|null, Error> {
  return ResultAsync.fromPromise(
    youtube('v3').videos.list({
      auth,
      part: [ 'id', 'snippet' ],
      id: [id],
    }),
    e => e as Error,
  ).map(response => {
    if (!response.data.items) {
      return null;
    }
    return response.data.items[0] || null;
  });
}

export function getVideoByName(
  auth: OAuth2Client,
  name: string,
): ResultAsync<youtube_v3.Schema$Video|null, Error> {
  return ResultAsync.fromPromise(
    youtube('v3').search.list({
      auth,
      forMine: true,
      type: ['video'],
      part: [ 'id', 'snippet' ],
      q: `"${name}"`,
    }),
    e => e as Error,
  ).map(response => {
    if (!response.data.items || response.data.items.length == 0) {
      return null;
    }
    logger.debug(`Search results for "${name}":`,
      response.data.items.map(item => item.snippet?.title));
    const match = response.data.items.find(item => item.snippet?.title === name);
    if (!match) {
      return null;
    }
    return {
      ...match,
      id: match.id?.videoId,
    };
  });
}

export function updateVideo(
  auth: OAuth2Client,
  id: string,
  metadata: youtube_v3.Schema$Video,
): ResultAsync<youtube_v3.Schema$Video, Error> {
  return ResultAsync.fromPromise(
    youtube('v3').videos.update({
      auth,
      part: [ 'snippet' ],
      requestBody: {
        ...metadata,
        id,
      },
    }),
    e => e as Error,
  ).map(response => {
    return response.data;
  });
}

export function titleify(name: string): string {
  // TODO: How do they handle unicode?
  return name.replace(/[^A-Za-z0-9&]/g, ' ').substring(0, 100).trim();
}

export function titleSize(title: string): number {
  return title.length;
}

export function descriptionSize(desc: string): number {
  return Buffer.byteLength(desc);
}

export function sanitizeTitle(str: string): SanitizedTitle {
  const sanitized = str.replace(/</g, 'ᐸ')
    .replace(/>/g, 'ᐳ');
  return sanitized as SanitizedTitle;
}

export function sanitizeDescription(str: string): SanitizedDescription {
  return sanitizeTitle(str);
}

export function tagsSize(tags: string[]): number {
  const characterCount = tags
    .map(t => t.includes(' ') || t.includes(',') ? t.length + 2 : t.length)
    .reduce((acc, curr) => acc + curr);
  const commas = Math.max(tags.length - 1, 0);
  return characterCount + commas;
}

export function sanitizeTag(str: string): SanitizedTag {
  const sanitized = str.replace(/[,.?!|/\\(){}\[\]<>]/g, '')
    .trim();
  // TODO: Actually make this an exhaustive list?
  return sanitized as SanitizedTag;
}
