import log4js from 'log4js';
const logger = log4js.getLogger('server/twitter/oauth');
logger.error = logger.error.bind(logger);

import crypto from 'crypto';
import OAuth from 'oauth-1.0a';

import { AccessToken } from "../../models/twitter";
import { checkResponseStatus } from '../../util/http';

export default class TwitterOAuth {
  private oauth: OAuth;
  private onAuth: (accessToken: AccessToken) => void;
  private apiKey: string;
  private tempToken: string | null = null;
  private tempTokenSecret: string | null = null;

  public constructor(
    apiKey: string,
    apiKeySecret: string,
    onAuth: (accessToken: AccessToken) => void) 
  {
    this.apiKey = apiKey;
    this.oauth = new OAuth({
      consumer: {
        key: apiKey,
        secret: apiKeySecret,
      },
      'signature_method': 'HMAC-SHA1',
      'hash_function'(baseString, key) {
        return crypto
          .createHmac('sha1', key)
          .update(baseString)
          .digest('base64');
      },
    });
    this.onAuth = onAuth;
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

  public async authorize(params: Record<string, string>): Promise<string> {
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
        const accessToken = {
          key: params.get('oauth_token') || '',
          secret: params.get('oauth_token_secret') || '',
        };
        this.onAuth(accessToken);
        return `Success!<br>${JSON.stringify(accessToken)}`;
      })
      .catch(e => {
        return `Error: ${e}`;
      });
  }
}
