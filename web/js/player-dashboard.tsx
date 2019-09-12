import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';

const PlayerDashboard: FunctionalComponent = ({}: RenderableProps<{}>): VNode => {
  return(
    <form class="scoreboard js-scoreboard tabbable-section-content" autocomplete="off">
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
