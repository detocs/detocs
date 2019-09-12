import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';

const CommentaryDashboard: FunctionalComponent = ({}: RenderableProps<{}>): VNode => {
  return(
    <form class="commentary js-lowerthird tabbable-section-content" autocomplete="off">
      <div class="players">
        <fieldset name="commentator" class="commentator js-commentator">
          <legend>Commentator 1</legend>
          {/* 
            // @ts-ignore */}
          <person-fields
            class="input-row"
            data-fields='["handle", "prefix", "twitter"]'>
            {/* 
              // @ts-ignore */}
          </person-fields>
        </fieldset>
        <fieldset name="commentator" class="commentator js-commentator">
          <legend>Commentator 2</legend>
          {/* 
            // @ts-ignore */}
          <person-fields
            class="input-row"
            data-fields='["handle", "prefix", "twitter"]'>
            {/* 
              // @ts-ignore */}
          </person-fields>
        </fieldset>
      </div>
      <div class="input-row">
        <fieldset name="tournament">
          <legend>Tournament</legend>
          <div class="input-row">
            <input
              type="text"
              name="tournament"
              placeholder="Tournament"
            />
          </div>
        </fieldset>
        <fieldset name="event">
          <legend>Event</legend>
          <div class="input-row">
            <input
              type="text"
              name="event"
              placeholder="Event"
            />
          </div>
        </fieldset>
      </div>
      <div class="input-row">
        <button type="button" class="js-reset-commentators">Reset</button>
        <button type="button" class="js-swap-commentators">Swap</button>
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default CommentaryDashboard;
