import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { nullMatch } from '@models/match';
import { nullPerson } from '@models/person';
import BracketState from '@server/bracket/state';
import InfoState from '@server/info/state';

import { infoEndpoint } from './api';
import BracketSet from './bracket-set';
import GameFields from './game-fields';
import {
  usePlayer1, usePlayer2,
  useScore1, useScore2,
  useComment1, useComment2,
  useInLosers1, useInLosers2,
  useMatch,
  useGame,
} from './hooks/info';
import MatchFields from './match-fields';
import PlayerFields from './player-fields';

interface Props {
  state: InfoState;
  updateState: StateUpdater<InfoState>;
  bracketState: BracketState;
  reversed: boolean;
}

const PlayerDashboard: FunctionalComponent<Props> = ({
  state,
  updateState,
  bracketState,
  reversed,
}): VNode => {
  const [ player1, updatePlayer1 ] = usePlayer1(state, updateState);
  const [ score1, updateScore1 ] = useScore1(state, updateState);
  const [ comment1, updateComment1 ] = useComment1(state, updateState);
  const [ inLosers1, updateInLosers1 ] = useInLosers1(state, updateState);
  const [ player2, updatePlayer2 ] = usePlayer2(state, updateState);
  const [ score2, updateScore2 ] = useScore2(state, updateState);
  const [ comment2, updateComment2 ] = useComment2(state, updateState);
  const [ inLosers2, updateInLosers2 ] = useInLosers2(state, updateState);
  const [ match, updateMatch ] = useMatch(state, updateState);
  const [ game, updateGame ] = useGame(state, updateState);
  const players = [
    <PlayerFields
      prefix="players[0]"
      index={0}
      person={player1}
      onUpdatePerson={updatePlayer1}
      score={score1}
      onUpdateScore={updateScore1}
      comment={comment1 || ''}
      onUpdateComment={updateComment1}
      inLosers={!!inLosers1}
      onUpdateInLosers={updateInLosers1}
    />,
    <PlayerFields
      prefix="players[1]"
      index={1}
      person={player2}
      onUpdatePerson={updatePlayer2}
      score={score2}
      onUpdateScore={updateScore2}
      comment={comment2 || ''}
      onUpdateComment={updateComment2}
      inLosers={!!inLosers2}
      onUpdateInLosers={updateInLosers2}
    />
  ];
  if (reversed) {
    players.reverse();
  }
  return(
    <form
      action={infoEndpoint('/scoreboard').href}
      method="post"
      class="scoreboard"
      autocomplete="off"
    >
      <div class="players">
        {players}
      </div>
      <div class="input-row">
        <MatchFields value={match} updateValue={updateMatch} />
        <GameFields value={game} updateValue={updateGame} />
        <BracketSet
          set={state.set}
          unfinishedSets={bracketState.unfinishedSets}
        />
      </div>
      <div class="action-row">
        <button type="button" class="warning" onClick={resetPlayers.bind({}, state, updateState)}>
          Reset Players
        </button>
        <button type="button" onClick={resetScores.bind({}, state, updateState)}>
          Reset Scores
        </button>
        <button type="button" onClick={swapPlayers.bind({}, state, updateState)}>
          Swap
        </button>
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default PlayerDashboard;

function resetPlayers(state: InfoState, updateState: StateUpdater<InfoState>): void {
  const newState = Object.assign({}, state);
  newState.players = newState.players.map(() => ({
    person: nullPerson,
    score: 0,
  }));
  newState.match = nullMatch;
  updateState(newState);
}

function resetScores(state: InfoState, updateState: StateUpdater<InfoState>): void {
  const newState = Object.assign({}, state);
  newState.players = newState.players.map(p => ({ ...p, score: 0 }));
  updateState(newState);
}

function swapPlayers(state: InfoState, updateState: StateUpdater<InfoState>): void {
  const newState = Object.assign({}, state);
  newState.players = [ newState.players[1], newState.players[0] ];
  updateState(newState);
}
