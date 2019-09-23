import { StateUpdater } from 'preact/hooks';

import Person, { PersonUpdate } from '../../../models/person';
import InfoState from '../../../server/info/state';

export function useInfoState<T>(
  getter: (state: InfoState) => T,
  setter: (state: InfoState, value: T) => void,
): (state: InfoState, updateState: StateUpdater<InfoState>) => [ T, (value: T) => void ] {
  return (state, updateState) => [
    getter(state),
    value => {
      const newState = Object.assign({}, state);
      setter(newState, value);
      updateState(newState);
    },
  ];
}

export const usePlayer1 = useInfoState<PersonUpdate>(
  state => state.players[0].person,
  (state, value) => state.players[0].person = value as Person,
);
export const usePlayer2 = useInfoState<PersonUpdate>(
  state => state.players[1].person,
  (state, value) => state.players[1].person = value as Person,
);
export const useScore1 = useInfoState<number>(
  state => state.players[0].score,
  (state, value) => state.players[0].score = value,
);
export const useScore2 = useInfoState<number>(
  state => state.players[1].score,
  (state, value) => state.players[1].score = value,
);
export const useComment1 = useInfoState<string | undefined>(
  state => state.players[0].comment,
  (state, value) => state.players[0].comment = value,
);
export const useComment2 = useInfoState<string | undefined>(
  state => state.players[1].comment,
  (state, value) => state.players[1].comment = value,
);
export const useInLosers1 = useInfoState<boolean | undefined>(
  state => state.players[0].inLosers,
  (state, value) => state.players[0].inLosers = value,
);
export const useInLosers2 = useInfoState<boolean | undefined>(
  state => state.players[1].inLosers,
  (state, value) => state.players[1].inLosers = value,
);
export const useCommentator1 = useInfoState<PersonUpdate>(
  state => state.commentators[0].person,
  (state, value) => state.commentators[0].person = value as Person,
);
export const useCommentator2 = useInfoState<PersonUpdate>(
  state => state.commentators[1].person,
  (state, value) => state.commentators[1].person = value as Person,
);
