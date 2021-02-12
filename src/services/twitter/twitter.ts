import { Error as ChainableError } from 'chainable-error';
import Twit from 'twit';

import { getCredentials, saveCredentials } from '@util/configuration/credentials';
import { getLogger } from '@util/logger';

import TwitterOAuth from './oauth';
import * as requests from './requests';
import { AccessToken, User } from './types';

const logger = getLogger('services/twitter');

export type LoginCallback = (user: User) => unknown;

export default interface TwitterClient {
  hasCredentials(): boolean;
  isLoggedIn(): boolean;
  onLogin(cb: LoginCallback): void;
  offLogin(cb: LoginCallback): void;
  getAuthorizeUrl(port: number): Promise<string>;
  authorize(params: Record<string, string>): Promise<void>;
  logIn(accessToken: AccessToken): Promise<void>;
  tweet(body: string, replyTo: string | null, mediaPath?: string): Promise<string>;
}

export class ApiTwitterClient implements TwitterClient {
  private readonly oauth: TwitterOAuth;
  private readonly twitterKey: string;
  private readonly twitterSecret: string;
  private loginCallbacks: LoginCallback[] = [];
  private twit: Twit | null = null;
  private user: User | null = null;

  public constructor(twitterKey: string, twitterSecret: string) {
    this.twitterKey = twitterKey;
    this.twitterSecret = twitterSecret;
    this.oauth = new TwitterOAuth(this.twitterKey, this.twitterSecret);
  }

  public hasCredentials(): boolean {
    return true;
  }

  public isLoggedIn(): boolean {
    return !!this.user;
  }

  public onLogin(cb: LoginCallback): void {
    this.loginCallbacks.push(cb);
    if (this.user) {
      cb(this.user);
    }
  }

  public offLogin(cb: LoginCallback): void {
    this.loginCallbacks = this.loginCallbacks.filter(x => x !== cb);
  }

  public async getAuthorizeUrl(port: number): Promise<string> {
    logger.info('Getting request token');
    return this.oauth.getAuthorizeUrl(`http://localhost:${port}/authorize`);
  }

  public async authorize(params: Record<string, string>): Promise<void> {
    logger.info('Handling authorization callback');
    const accessToken = await this.oauth.authorize(params);
    getCredentials().twitterToken = accessToken;
    saveCredentials();
    await this.logIn(accessToken);
  }

  public async logIn(accessToken: AccessToken): Promise<void> {
    try {
      const twit = new Twit({
        'consumer_key': this.twitterKey,
        'consumer_secret': this.twitterSecret,
        'access_token': accessToken.key,
        'access_token_secret': accessToken.secret,
      });
      const user = await requests.getUser(twit);
      this.twit = twit;
      this.user = user;
      this.loginCallbacks.forEach(cb => cb(user));
    } catch (err) {
      throw new ChainableError('Unable to log in', err);
    }
  }

  public async tweet(body: string, replyTo: string | null, mediaPath?: string): Promise<string> {
    if (!this.twit) {
      throw new Error('Twitter client not logged in');
    }
    return requests.tweet(this.twit, body, replyTo, mediaPath);
  }
}

export class MockTwitterClient implements TwitterClient {
  public hasCredentials(): boolean {
    return false;
  }

  public isLoggedIn(): boolean {
    return false;
  }

  public onLogin(): void {
    return;
  }

  public offLogin(): void {
    return;
  }

  public getAuthorizeUrl(): Promise<string> {
    throw new Error('No Twitter credentials available');
  }

  public authorize(): Promise<void> {
    throw new Error('No Twitter credentials available');
  }

  public logIn(): Promise<void> {
    throw new Error('No Twitter credentials available');
  }

  public tweet(): Promise<string> {
    throw new Error('No Twitter credentials available');
  }
}
