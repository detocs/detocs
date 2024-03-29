import { Error as ChainableError } from 'chainable-error';
import { errAsync, ResultAsync } from 'neverthrow';
import { TwitterApi, TwitterApiReadWrite } from 'twitter-api-v2';

import { getCredentials, saveCredentials } from '@util/configuration/credentials';
import { getLogger } from '@util/logger';

import TwitterOAuth from './oauth';
import * as requests from './requests';
import { AccessToken, User } from './types';

const logger = getLogger('services/twitter');

export type LoginCallback = (user: User) => unknown;

export interface TwitterClient {
  hasCredentials(): boolean;
  isLoggedIn(): boolean;
  onLogin(cb: LoginCallback): void;
  offLogin(cb: LoginCallback): void;
  getAuthorizeUrl(port: number): Promise<string>;
  authorize(params: Record<string, string>): Promise<void>;
  logIn(accessToken: AccessToken): ResultAsync<void, Error>;
  tweet(body: string, replyTo: string | null, mediaPath?: string): ResultAsync<string, Error>;
}

interface TwitterCredentials {
  twitterKey: string;
  twitterSecret: string;
}

export class ApiTwitterClient implements TwitterClient {
  private readonly oauth: TwitterOAuth;
  private readonly twitterKey: string;
  private readonly twitterSecret: string;
  private loginCallbacks: LoginCallback[] = [];
  private client: TwitterApiReadWrite | null = null;
  private user: User | null = null;

  static async getClient({
    twitterKey,
    twitterSecret,
  }: TwitterCredentials): Promise<ApiTwitterClient> {
    const twitterClient = new ApiTwitterClient(twitterKey, twitterSecret);
    const accessToken = getCredentials().twitterToken;
    if (accessToken) {
      // TODO: Handle revoked tokens
      logger.info('Already logged in');
      await twitterClient.logIn(accessToken)
        .mapErr(logger.error);
    }
    return twitterClient;
  }

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

  public logIn(accessToken: AccessToken): ResultAsync<void, Error> {
    const client = new TwitterApi({
      appKey: this.twitterKey,
      appSecret: this.twitterSecret,
      accessToken: accessToken.key,
      accessSecret: accessToken.secret,
    });
    this.client = client.readWrite;
    return requests.getUser(this.client)
      .map(user => {
        this.user = user;
        this.loginCallbacks.forEach(cb => cb(user));
      })
      .mapErr(err => new ChainableError('Unable to log in', err));
  }

  public tweet(
    body: string,
    replyTo: string | null,
    mediaPath?: string,
  ): ResultAsync<string, Error> {
    if (!this.client) {
      return errAsync(new Error('Twitter client not logged in'));
    }
    return requests.tweet(this.client, body, replyTo, mediaPath)
      .map(tweetId => {
        logger.info(`Created tweet ${tweetId}${replyTo ? ` as a reply to ${replyTo}` : ''}`);
        return tweetId;
      });
  }
}

export class MockTwitterClient implements TwitterClient {
  static getClient(): MockTwitterClient {
    return new MockTwitterClient();
  }

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

  public logIn(): ResultAsync<void, Error> {
    return errAsync(new Error('No Twitter credentials available'));
  }

  public tweet(): ResultAsync<string, Error> {
    return errAsync(new Error('No Twitter credentials available'));
  }
}
