import { h, VNode, Fragment } from 'preact';

export interface Props {
  playersReversed: boolean;
  togglePlayersReversed: VoidFunction;
  commentatorsReversed: boolean;
  toggleCommentatorsReversed: VoidFunction;
}

export default function SettingsDashboard({
  playersReversed,
  togglePlayersReversed,
  commentatorsReversed,
  toggleCommentatorsReversed,
}: Props): VNode {
  return (
    <Fragment>
      <fieldset>
        <legend>Client Settings</legend>
        <div class="input-block">
          <label>
            <input
              type="checkbox"
              checked={playersReversed}
              onChange={togglePlayersReversed}
            />
            {' '}
            Reverse player order
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={commentatorsReversed}
              onChange={toggleCommentatorsReversed}
            />
            {' '}
            Reverse commentator order
          </label>
        </div>
      </fieldset>
    </Fragment>
  );
}
