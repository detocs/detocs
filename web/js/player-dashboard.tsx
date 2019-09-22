import { h, FunctionalComponent, VNode } from 'preact';

import SetSelector, { Props as SetSelectorProps } from './set-selector';

export type Props = SetSelectorProps;

const PlayerDashboard: FunctionalComponent<Props> = (props): VNode => {
  return(
    <form class="scoreboard js-scoreboard" autocomplete="off">
      <div class="players">
        {/* 
          // @ts-ignore */}
        <player-fields data-index="0"></player-fields>
        {/* 
          // @ts-ignore */}
        <player-fields data-index="1"></player-fields>
      </div>
      <div class="input-row">
        {/* 
          // @ts-ignore */}
        <match-fields></match-fields>
        {/* 
          // @ts-ignore */}
        <game-fields></game-fields>
        <input type="text" name="phaseId" placeholder="Phase" size={7} style="flex: 0 0 auto;" />
        <SetSelector {...props}/>
      </div>
      <div class="input-row">
        <button type="button" class="js-reset-players">Reset Players</button>
        <button type="button" class="js-reset-scores">Reset Scores</button>
        <button type="button" class="js-swap-players">Swap</button>
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default PlayerDashboard;
