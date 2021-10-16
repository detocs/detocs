import { h, VNode, Fragment } from 'preact';

export interface Props {
  playersReversed: boolean;
  togglePlayersReversed: VoidFunction;
  commentatorsReversed: boolean;
  toggleCommentatorsReversed: VoidFunction;
  thumbnailVideosEnabled: boolean;
  toggleThumbnailVideosEnabled: VoidFunction;
}

export default function SettingsDashboard({
  playersReversed,
  togglePlayersReversed,
  commentatorsReversed,
  toggleCommentatorsReversed,
  thumbnailVideosEnabled,
  toggleThumbnailVideosEnabled,
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
          <br />
          <label>
            <input
              type="checkbox"
              checked={thumbnailVideosEnabled}
              onChange={toggleThumbnailVideosEnabled}
            />
            {' '}
            Enable video thumbnails
          </label>
        </div>
      </fieldset>
    </Fragment>
  );
}
