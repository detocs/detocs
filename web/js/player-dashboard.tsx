import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { nullPerson } from '../../models/person';
import InfoState from '../../server/info/state';

import { usePlayer1, usePlayer2, useScore1, useScore2, useComment1, useComment2, useInLosers1, useInLosers2 } from './hooks/info';

import PlayerFields from './player-fields';
import SetSelector from './set-selector';

interface Props {
  state: InfoState;
  updateState: StateUpdater<InfoState>;
}

const PlayerDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const [ player1, updatePlayer1 ] = usePlayer1(state, updateState);
  const [ score1, updateScore1 ] = useScore1(state, updateState);
  const [ comment1, updateComment1 ] = useComment1(state, updateState);
  const [ inLosers1, updateInLosers1 ] = useInLosers1(state, updateState);
  const [ player2, updatePlayer2 ] = usePlayer2(state, updateState);
  const [ score2, updateScore2 ] = useScore2(state, updateState);
  const [ comment2, updateComment2 ] = useComment2(state, updateState);
  const [ inLosers2, updateInLosers2 ] = useInLosers2(state, updateState);
  return(
    <form class="scoreboard js-scoreboard" autocomplete="off">
      <div class="players">
        <PlayerFields
          prefix="players[]"
          personFields={[ "handle", "prefix" ]}
          index={0}
          person={player1}
          onUpdatePerson={updatePlayer1}
          score={score1}
          onUpdateScore={updateScore1}
          comment={comment1 || ''}
          onUpdateComment={updateComment1}
          inLosers={!!inLosers1}
          onUpdateInLosers={updateInLosers1}
        />
        <PlayerFields
          prefix="players[]"
          personFields={[ "handle", "prefix" ]}
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
      </div>
      <div class="input-row">
        {/* 
          // @ts-ignore */}
        <match-fields></match-fields>
        {/* 
          // @ts-ignore */}
        <game-fields></game-fields>
        <input type="text" name="phaseId" placeholder="Phase" size={7} style="flex: 0 0 auto;" />
        <SetSelector {...state} updateSet={console.log}/>
      </div>
      <div class="input-row">
        <button type="button" onClick={resetPlayers.bind({}, state, updateState)}>Reset Players</button>
        <button type="button" onClick={resetScores.bind({}, state, updateState)}>Reset Scores</button>
        <button type="button" onClick={swapPlayers.bind({}, state, updateState)}>Swap</button>
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default PlayerDashboard;

function resetPlayers(state: InfoState, updateState: StateUpdater<InfoState>) {
  const newState = Object.assign({}, state);
  newState.players = newState.players.map(() => ({
    person: nullPerson,
    score: 0,
  }));
  updateState(newState)
}

function resetScores(state: InfoState, updateState: StateUpdater<InfoState>) {
  const newState = Object.assign({}, state);
  newState.players.forEach(p => p.score = 0);
  updateState(newState)
}

function swapPlayers(state: InfoState, updateState: StateUpdater<InfoState>) {
  const newState = Object.assign({}, state);
  newState.players = [ newState.players[1], newState.players[0] ];
  updateState(newState)
}
