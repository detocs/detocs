import cloneDeep from 'lodash.clonedeep';

import Person from '@models/person';
import Player from '@models/player';
import State, { sampleState as origSample } from '@server/info/state';
import LowerThird from '@models/lower-third';

export default interface Output {
  init(): Promise<void>;
  update(state: State): void;
}

/**
 * Massages the state into a form more convenient to work with, and lets us
 * handle backwards-compatibility
 */
export type OutputState = Omit<State, 'players' | 'commentators'> & {
  players: (Player & {
    person: Person & {
      twitter?: string;
    };
  })[];
  commentators: (LowerThird['commentators'][0] & {
    person: Person & {
      twitter?: string;
    };
  })[];
} & {
  readonly __tag: unique symbol; // Newtype pattern to avoid mixing with State
};

export function toOutputState(state: State): OutputState {
  const out = cloneDeep(state) as OutputState;
  for (const player of out.players) {
    player.person.twitter = player.person.serviceIds.twitter;
  }
  out.players.map(player => player.person)
    .concat(out.commentators.map(commentator => commentator.person))
    .forEach(person => {
      person.twitter = person.serviceIds.twitter;
    });
  return out;
}

export const sampleState = Object.freeze(toOutputState(origSample));
