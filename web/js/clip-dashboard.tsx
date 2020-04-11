import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { Clip } from '../../models/media';
import { State } from '../../server/media-dashboard/state';

import { mediaDashboardEndpoint } from './api';

interface Props {
  state: State;
  updateState: StateUpdater<State>;
}

interface EditorProps {
  clip: Clip;
  autoplay: boolean;
}

const updateEndpoint = mediaDashboardEndpoint('/update').href;
const clip10Endpoint = mediaDashboardEndpoint('/clip10').href;

function clip10(): void {
  fetch(clip10Endpoint, { method: 'POST' }).catch(console.error);
}

const VideoEdtior: FunctionalComponent<EditorProps> = ({ clip, autoplay }): VNode => {
  return (
    <form
      method="post"
      action={updateEndpoint}
      class="video-editor"
      autocomplete="off"
    >
      <video
        class="video-editor__video"
        src={`${clip.video.url}#t=${clip.clipStartMs / 1000},${clip.clipEndMs / 1000}`}
        autoPlay={autoplay}
        controls
        loop={true}
        muted={true}
      >
      </video>
      <div class="video-editor__trimmer">
        <img class="video-editor__waveform" src={clip.waveform.url} />
        <input
          type="range"
          name="startMs"
          className="video-editor__range-start"
          min={0}
          max={clip.video.durationMs}
          value={clip.clipStartMs}
        />
        <input
          type="range"
          name="endMs"
          className="video-editor__range-end"
          min={0}
          max={clip.video.durationMs}
          value={clip.clipEndMs}
        />
      </div>
    </form>
  );
};

const ClipDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  return (
    <Fragment>
      <div class="input-row">
        <button type="button" onClick={clip10}>10s</button>
      </div>
      <ol class="clips__list">
        {state.clips
          .slice()
          .reverse()
          .map((clip, i) =>
            <li key={clip.video.filename} class="clips__list-item">
              {VideoEdtior({ clip, autoplay: i === 0 })}
            </li>)}
      </ol>
    </Fragment>
  );
};
export default ClipDashboard;
