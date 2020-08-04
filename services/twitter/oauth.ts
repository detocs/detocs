// TODO: Replace with interface
import OAuth from 'oauth-1.0a';

import { checkResponseStatus } from '@util/ajax';
import { getLogger } from '@util/logger';
import { getOauth1 } from '@util/oauth';

import { AccessToken } from './types';

const logger = getLogger('services/twitter/oauth');

export default class TwitterOAuth {
  private oauth: OAuth;
  private apiKey: string;
  private tempToken: string | null = null;
  private tempTokenSecret: string | null = null;

  public constructor(
    apiKey: string,
    apiKeySecret: string,
  ) {
    this.apiKey = apiKey;
    this.oauth = getOauth1(apiKey, apiKeySecret);
  }

  public async getAuthorizeUrl(callbackUrl: string): Promise<string> {
    logger.info('Getting request token');
    const requestData = {
      url: 'https://api.twitter.com/oauth/request_token',
      method: 'POST',
      data: { 'oauth_callback': callbackUrl },
    };

    const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData));
    return await fetch(
      requestData.url,
      {
        method: requestData.method,
        headers: { 'Authorization': authHeader.Authorization },
      })
      .then(checkResponseStatus)
      .then(resp => resp.text())
      .then(text => new URLSearchParams(text))
      .then(params => {
        if (params.get('oauth_callback_confirmed') !== 'true') {
          throw new Error('OAuth callback not confirmed');
        }
        this.tempToken = params.get('oauth_token');
        this.tempTokenSecret = params.get('oauth_token_secret');
        return `https://api.twitter.com/oauth/authorize?oauth_token=${this.tempToken}`;
      })
      .catch(e => {
        logger.error(`Unable to get request token: ${e}`);
        return '#';
      });
  }

  public async authorize(params: Record<string, string>): Promise<AccessToken> {
    logger.info('Handling authorization callback');
    if (!this.tempToken) {
      throw new Error('Authorize called before temp token available');
    }

    if (params['oauth_token'] !== this.tempToken) {
      throw new Error('Callback token doesn\'t match');
    }
    const verifier = params['oauth_verifier'];

    const requestData = {
      url: 'https://api.twitter.com/oauth/access_token',
      method: 'POST',
      data: {
        'oauth_consumer_key': this.apiKey,
        'oauth_token': this.tempToken,
        'oauth_verifier': verifier,
      },
    };
    const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData));

    return await fetch(
      requestData.url,
      {
        method: requestData.method,
        headers: { 'Authorization': authHeader.Authorization },
      })
      .then(checkResponseStatus)
      .then(resp => resp.text())
      .then(text => new URLSearchParams(text))
      .then(params => {
        const key = params.get('oauth_token');
        const secret = params.get('oauth_token_secret');
        if (!key) {
          throw new Error('oauth_token not returned token endpoint');
        }
        if (!secret) {
          throw new Error('oauth_token_secret not returned token endpoint');
        }
        return { key: key, secret: secret };
      });
  }
}
