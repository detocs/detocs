import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useEffect, useRef, StateUpdater } from 'preact/hooks';

import ServerState from '../../server/recording/state';

import { recordingEndpoint } from './api';
import { useStartTimestamp, useStopTimestamp } from './hooks/recording';
import { Thumbnail } from './thumbnail';
import { TimestampInput } from './timestamp';

interface Props {
  state: ServerState;
  updateState: StateUpdater<ServerState>;
}

const startEndpoint = recordingEndpoint('/start').href;
const stopEndpoint = recordingEndpoint('/stop').href;
const saveEndpoint = recordingEndpoint('/save').href;

function start(): void {
  fetch(startEndpoint, { method: 'POST' }).catch(console.error);
}

function stop(): void {
  fetch(stopEndpoint, { method: 'POST' }).catch(console.error);
}

function save(): void {
  fetch(saveEndpoint, { method: 'POST' }).catch(console.error);
}

const RecordingDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const [ startTimestamp, updateStart ] = useStartTimestamp(state, updateState);
  const [ stopTimestamp, updateStop ] = useStopTimestamp(state, updateState);

  const ref = useRef();
  useEffect(() => {
    let tabElement = (ref.current as HTMLElement).closest('.tabbable-section');
    tabElement = tabElement && tabElement.querySelector('.tabbable-section__tab label');
    if (tabElement) {
      tabElement.classList.toggle(
        'recording__tab-label--recording',
        !!startTimestamp && !stopTimestamp);
    }
  }, [startTimestamp, stopTimestamp]);

  const canStop = !startTimestamp;
  // TODO: Prevent saving if start > stop
  const canSave = !(startTimestamp && stopTimestamp);

  return (
    <Fragment>
      <form
        ref={ref}
        action={recordingEndpoint('/update').href}
        method="post"
        class="recording__editor"
        autocomplete="off"
      >
        <fieldset class="recording__boundary">
          <legend>Beginning</legend>
          <Thumbnail
            src={state.startThumbnail} />
          <TimestampInput
            name="start-timestamp"
            value={startTimestamp}
            updater={updateStart}
          />
        </fieldset>
        <span className="recording__controls">
          <button type="button" onClick={start}>Start</button>
          <button type="button" onClick={stop} disabled={canStop}>Stop</button>
          <button type="submit">Update</button>
          <button type="button" onClick={save} disabled={canSave}>Save</button>
        </span>
        <fieldset class="recording__boundary">
          <legend>End</legend>
          <Thumbnail
            src={state.stopThumbnail} />
          <TimestampInput
            name="stop-timestamp"
            value={stopTimestamp}
            updater={updateStop}
          />
        </fieldset>
      </form>
      <input
        readOnly
        value={state.clipFile || ''}
        placeholder="Output File"
        class="recording__file"
        dir="rtl" // TODO: This is a hack
      />
    </Fragment>
  );
};
export default RecordingDashboard;


