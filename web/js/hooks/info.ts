import Game from '../../../models/game';
import Match from '../../../models/match';
import Person, { PersonUpdate } from '../../../models/person';
import InfoState from '../../../server/info/state';

import { useSubstate } from './substate';

export const usePlayer1 = useSubstate<InfoState, PersonUpdate>(
  state => state.players[0].person,
  (state, value) => state.players[0].person = value as Person,
);
export const usePlayer2 = useSubstate<InfoState, PersonUpdate>(
  state => state.players[1].person,
  (state, value) => state.players[1].person = value as Person,
);
export const useScore1 = useSubstate<InfoState, number>(
  state => state.players[0].score,
  (state, value) => state.players[0].score = value,
);
export const useScore2 = useSubstate<InfoState, number>(
  state => state.players[1].score,
  (state, value) => state.players[1].score = value,
);
export const useComment1 = useSubstate<InfoState, string | undefined>(
  state => state.players[0].comment,
  (state, value) => state.players[0].comment = value,
);
export const useComment2 = useSubstate<InfoState, string | undefined>(
  state => state.players[1].comment,
  (state, value) => state.players[1].comment = value,
);
export const useInLosers1 = useSubstate<InfoState, boolean | undefined>(
  state => state.players[0].inLosers,
  (state, value) => state.players[0].inLosers = value,
);
export const useInLosers2 = useSubstate<InfoState, boolean | undefined>(
  state => state.players[1].inLosers,
  (state, value) => state.players[1].inLosers = value,
);
export const useCommentator1 = useSubstate<InfoState, PersonUpdate>(
  state => state.commentators[0].person,
  (state, value) => state.commentators[0].person = value as Person,
);
export const useCommentator2 = useSubstate<InfoState, PersonUpdate>(
  state => state.commentators[1].person,
  (state, value) => state.commentators[1].person = value as Person,
);
export const useMatch = useSubstate<InfoState, Match>(
  state => state.match,
  (state, value) => state.match = value,
);
export const useGame = useSubstate<InfoState, Game>(
  state => state.game,
  (state, value) => state.game = value,
);
export const useBreakMessages = useSubstate<InfoState, string[]>(
  state => state.messages,
  (state, value) => state.messages = value,
);
