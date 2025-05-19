import updateImmutable from 'immutability-helper';

import Game from '@models/game';
import Match from '@models/match';
import Person, { PersonUpdate } from '@models/person';
import InfoState from '@server/info/state';

import { useLocalState } from './local-state';
import { createSubstatehook } from './substate';


const usePlayer1Substate = createSubstatehook<InfoState, PersonUpdate>(
  state => state.players[0].person,
  (state, value) => updateImmutable(
    state,
    { players: { 0: { person: { $set: value as Person } } } },
  ),
);
export const usePlayer1: typeof usePlayer1Substate = (state, updateState) => {
  return useLocalState(
    usePlayer1Substate(state, updateState)[0],
    {
      keyGenerator: JSON.stringify,
    }
  );
};

const usePlayer2Substate = createSubstatehook<InfoState, PersonUpdate>(
  state => state.players[1].person,
  (state, value) => updateImmutable(
    state,
    { players: { 1: { person: { $set: value as Person } } } },
  ),
);
export const usePlayer2: typeof usePlayer2Substate = (state, updateState) => {
  return useLocalState(
    usePlayer2Substate(state, updateState)[0],
    {
      keyGenerator: JSON.stringify,
    }
  );
};

const useScore1Substate = createSubstatehook<InfoState, number>(
  state => state.players[0].score,
  (state, value) => updateImmutable(
    state,
    { players: { 0: { score: { $set: value } } } },
  ),
);
export const useScore1: typeof useScore1Substate = (state, updateState) => {
  return useLocalState(
    useScore1Substate(state, updateState)[0],
  );
};

const useScore2Substate = createSubstatehook<InfoState, number>(
  state => state.players[1].score,
  (state, value) => updateImmutable(
    state,
    { players: { 1: { score: { $set: value } } } },
  ),
);
export const useScore2: typeof useScore2Substate = (state, updateState) => {
  return useLocalState(
    useScore2Substate(state, updateState)[0],
  );
};

const useComment1Substate = createSubstatehook<InfoState, string | undefined>(
  state => state.players[0].comment,
  (state, value) => updateImmutable(
    state,
    { players: { 0: { comment: { $set: value } } } },
  ),
);
export const useComment1: typeof useComment1Substate = (state, updateState) => {
  return useLocalState(
    useComment1Substate(state, updateState)[0],
  );
};

const useComment2Substate = createSubstatehook<InfoState, string | undefined>(
  state => state.players[1].comment,
  (state, value) => updateImmutable(
    state,
    { players: { 1: { comment: { $set: value } } } },
  ),
);
export const useComment2: typeof useComment2Substate = (state, updateState) => {
  return useLocalState(
    useComment2Substate(state, updateState)[0],
  );
};

const useInLosers1Substate = createSubstatehook<InfoState, boolean | undefined>(
  state => state.players[0].inLosers,
  (state, value) => updateImmutable(
    state,
    { players: { 0: { inLosers: { $set: value } } } },
  ),
);
export const useInLosers1: typeof useInLosers1Substate = (state, updateState) => {
  return useLocalState(
    useInLosers1Substate(state, updateState)[0],
  );
};

const useInLosers2Substate = createSubstatehook<InfoState, boolean | undefined>(
  state => state.players[1].inLosers,
  (state, value) => updateImmutable(
    state,
    { players: { 1: { inLosers: { $set: value } } } },
  ),
);
export const useInLosers2: typeof useInLosers2Substate = (state, updateState) => {
  return useLocalState(
    useInLosers2Substate(state, updateState)[0],
  );
};

const useCommentator1Substate = createSubstatehook<InfoState, PersonUpdate>(
  state => state.commentators[0].person,
  (state, value) => updateImmutable(
    state,
    { commentators: { 0: { person: { $set: value as Person } } } },
  ),
);
export const useCommentator1: typeof useCommentator1Substate = (state, updateState) => {
  return useLocalState(
    useCommentator1Substate(state, updateState)[0],
    {
      keyGenerator: JSON.stringify,
    }
  );
};

const useCommentator2Substate = createSubstatehook<InfoState, PersonUpdate>(
  state => state.commentators[1].person,
  (state, value) => updateImmutable(
    state,
    { commentators: { 1: { person: { $set: value as Person } } } },
  ),
);
export const useCommentator2: typeof useCommentator2Substate = (state, updateState) => {
  return useLocalState(
    useCommentator2Substate(state, updateState)[0],
    {
      keyGenerator: JSON.stringify,
    }
  );
};

const useMatchSubstate = createSubstatehook<InfoState, Match>(
  state => state.match,
  (state, value) => updateImmutable(
    state,
    { match: { $set: value } },
  ),
);
export const useMatch: typeof useMatchSubstate = (state, updateState) => {
  return useLocalState(
    useMatchSubstate(state, updateState)[0],
    {
      keyGenerator: JSON.stringify,
    }
  );
};

const useGameSubstate = createSubstatehook<InfoState, Game>(
  state => state.game,
  (state, value) => updateImmutable(
    state,
    { game: { $set: value } },
  ),
);
export const useGame: typeof useGameSubstate = (state, updateState) => {
  return useLocalState(
    useGameSubstate(state, updateState)[0],
    {
      keyGenerator: JSON.stringify,
    }
  );
};

const useTournamentSubstate = createSubstatehook<InfoState, string>(
  state => state.tournament,
  (state, value) => updateImmutable(
    state,
    { tournament: { $set: value } },
  ),
);
export const useTournament: typeof useTournamentSubstate = (state, updateState) => {
  return useLocalState(
    useTournamentSubstate(state, updateState)[0],
  );
};

const useEventSubstate = createSubstatehook<InfoState, string>(
  state => state.event,
  (state, value) => updateImmutable(
    state,
    { event: { $set: value } },
  ),
);
export const useEvent: typeof useEventSubstate = (state, updateState) => {
  return useLocalState(
    useEventSubstate(state, updateState)[0],
  );
};

const useBreakMessagesSubstate = createSubstatehook<InfoState, string[]>(
  state => state.messages,
  (state, value) => updateImmutable(
    state,
    { messages: { $set: value } },
  ),
);
export const useBreakMessages: typeof useBreakMessagesSubstate = (state, updateState) => {
  return useLocalState(
    useBreakMessagesSubstate(state, updateState)[0],
    {
      transform: messages => messages.length ? messages : [''],
      keyGenerator: JSON.stringify,
    }
  );
};
