import cloneDeep from 'lodash.clonedeep';

import Person from '@models/person';
import Player from '@models/player';
import State, { sampleState as origSample } from '@server/info/state';
import LowerThird from '@models/lower-third';
import { nonEmpty } from '@util/predicates';

export default interface Output {
  init(state: State): Promise<void>;
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
    nameAndStatus: string;
    prefixedNameAndStatus: string;
  })[];
  commentators: (LowerThird['commentators'][0] & {
    person: Person & {
      twitter?: string;
    };
    prefixedName: string;
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

  out.players.forEach(player => {
    player.nameAndStatus = [
      player.person.alias || player.person.handle,
      player.comment && `(${player.comment})`,
      player.inLosers ? '[L]' : '',
    ].filter(nonEmpty).join(' ');
    player.prefixedNameAndStatus = [
      player.person.prefix && `${player.person.prefix} |`,
      player.nameAndStatus,
    ].filter(nonEmpty).join(' ');
  });
  out.commentators.forEach(player => {
    player.prefixedName = [
      player.person.prefix && `${player.person.prefix} |`,
      player.person.alias || player.person.handle,
    ].filter(nonEmpty).join(' ');
  });

  return out;
}

export const sampleState = Object.freeze(toOutputState(origSample));
