import { User } from '@services/twitter/types';

export default interface ClientState {
  hasCredentials: boolean;
  user: User | null;
  // TODO: Store multiple threads, improve collaboration support
  lastTweetId: string | null;
}

export const nullState: ClientState = Object.freeze({
  hasCredentials: false,
  user: null,
  lastTweetId: null,
});
