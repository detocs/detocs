import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useEffect, useRef, StateUpdater } from 'preact/hooks';

import ServerState, { Recording } from '@server/recording/state';

import { recordingEndpoint } from './api';
import { useStartTimestamp, useStopTimestamp, useRecording } from './hooks/recording';
import { logError } from './log';
import { Thumbnail } from './thumbnail';
import { TimestampInput } from './timestamp';
import { checkResponseStatus } from '@util/ajax';

interface Props {
  state: ServerState;
  updateState: StateUpdater<ServerState>;
}

const startEndpoint = recordingEndpoint('/start').href;
const stopEndpoint = recordingEndpoint('/stop').href;
const updateEndpoint = recordingEndpoint('/update').href;
const cutEndpoint = recordingEndpoint('/cut').href;

function start(): void {
  fetch(startEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .catch(logError);
}

function stop(): void {
  fetch(stopEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .catch(logError);
}

const RecordingDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const recording = state.recordings[0];
  const isRecording = !!recording && !!recording.startTimestamp && !recording.stopTimestamp;

  const ref = useRef();
  useEffect(() => {
    let tabElement = (ref.current as HTMLElement).closest('.tabbable-section');
    tabElement = tabElement && tabElement.querySelector('.tabbable-section__tab label');
    if (!tabElement) {
      return;
    }
    tabElement.classList.toggle('recording__tab-label--recording', isRecording);
  });

  return (
    <Fragment>
      <div class="input-row">
        <button type="button" onClick={start}>Start</button>
        <button type="button" onClick={stop} disabled={!isRecording}>Stop</button>
      </div>
      <ol ref={ref} class="recording__list">
        {Array.from(state.recordings.keys()).map(index => {
          const [ recording, updateRecording ] = useRecording(state, updateState, index);
          return Recording({ recording, updateRecording });
        })}
      </ol>
    </Fragment>
  );
};
export default RecordingDashboard;

interface RecordingProps {
  recording: Recording;
  updateRecording: StateUpdater<Recording>;
}

const Recording: FunctionalComponent<RecordingProps> = ({ recording, updateRecording }): VNode => {
  const [ startTimestamp, updateStart ] = useStartTimestamp(recording, updateRecording);
  const [ stopTimestamp, updateStop ] = useStopTimestamp(recording, updateRecording);
  const canCut = startTimestamp && stopTimestamp && !recording.recordingFile;
  // TODO: Prevent saving if start > stop
  // TODO: Recut recordings
  return (
    <li key={recording.id} class="recording__list-item">
      <fieldset class="recording__block">
        { recording.displayName && <legend>{recording.displayName}</legend>}
        <form
          method="post"
          action={updateEndpoint}
          class="recording__editor"
          autocomplete="off"
        >
          <input type="hidden" name="id" value={recording.id}/>
          <fieldset class="recording__boundary">
            <legend>Beginning</legend>
            <div>
              <Thumbnail
                media={recording.startThumbnail} />
              <TimestampInput
                name="start-timestamp"
                value={startTimestamp}
                updater={updateStart}
              />
            </div>
          </fieldset>
          <span className="recording__controls">
            <button type="submit">Update</button>
            <button type="submit" formAction={cutEndpoint} disabled={!canCut}>Cut</button>
          </span>
          <fieldset class="recording__boundary">
            <legend>End</legend>
            <div>
              <Thumbnail
                media={recording.stopThumbnail} />
              <TimestampInput
                name="stop-timestamp"
                value={stopTimestamp}
                updater={updateStop}
              />
            </div>
          </fieldset>
        </form>
        { recording.recordingFile && <div class="recording__file">{recording.recordingFile}</div> }
      </fieldset>
    </li>
  );
};
