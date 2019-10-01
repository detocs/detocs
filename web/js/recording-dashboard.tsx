import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import ServerState from '../../server/recording/state';

import { recordingEndpoint } from './api';
import { Thumbnail } from './thumbnail';

type Props = ServerState;

const startEndpoint = recordingEndpoint('/start').href;
const stopEndpoint = recordingEndpoint('/stop').href;

function start(): void {
  fetch(startEndpoint).catch(console.error);
}

function stop(): void {
  fetch(stopEndpoint).catch(console.error);
}

const RecordingDashboard: FunctionalComponent<Props> = (props): VNode => {
  const ref = useRef();
  useEffect(() => {
    let tabElement = (ref.current as HTMLElement).closest('.tabbable-section');
    tabElement = tabElement && tabElement.querySelector('.tabbable-section__tab label');
    if (tabElement) {
      tabElement.classList.toggle(
        'recording__tab-label--recording',
        !!props.startTimestamp && !props.stopTimestamp);
    }
  }, [props.startTimestamp, props.stopTimestamp]);

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
            src={props.startThumbnail} />
          <TimestampInput
            name="start-timestamp"
            value={props.startTimestamp} />
        </fieldset>
        <div className="recording__controls">
          <button type="button" onClick={start}>Start</button>
          <button type="button" onClick={stop}>Stop</button>
          <button type="submit">Update</button>
        </div>
        <fieldset class="recording__boundary">
          <legend>End</legend>
          <Thumbnail
            src={props.stopThumbnail} />
          <TimestampInput
            name="stop-timestamp"
            value={props.stopTimestamp} />
        </fieldset>
      </form>
      <input
        readOnly
        value={props.clipFile || ''}
        placeholder="Output File"
        class="recording__file"
        dir="rtl" // TODO: This is a hack
      />
    </Fragment>
  );
};
export default RecordingDashboard;

const TimestampInput: FunctionalComponent<{ name: string; value: string | null }> =
({ name, value }): VNode => (
  <input
    type="text"
    name={name}
    value={value || ''}
    pattern="\d\d:\d\d:\d\d(\.\d\d\d)?"
    placeholder="00:00:00:000"
    size={12}
    title="Timestamp in the form HH:mm:ss.SSS"
    class="recording__timestamp" />
);
