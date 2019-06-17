import { h, render, Component, ComponentChild, VNode, FunctionalComponent } from 'preact';

import State from '../../server/recording/state';

import { recordingEndpoint } from './api';

export default class RecordingFieldsElement extends HTMLElement {
  private connectedCallback(): void {
    render(<RecordingFields />, this);
  }
}

interface RecordingFieldsState {
  serverState: State;
}

class RecordingFields extends Component {
  private static readonly startEndpoint = recordingEndpoint('/start').href;
  private static readonly stopEndpoint = recordingEndpoint('/stop').href;
  private static readonly nullState: State = {
    recordingFolder: null,
    recordingFile: null,
    clipFile: null,
    startTimestamp: null,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
  };

  public constructor() {
    super();
    this.state = {
      serverState: RecordingFields.nullState,
    };
    const ws = new WebSocket(recordingEndpoint('', 'ws:').href);
    ws.onmessage = this.updateServerState.bind(this);
    ws.onerror = console.error;
  }

  private updateServerState(ev: MessageEvent): void {
    const newState = JSON.parse(ev.data) as State;
    this.setState({ serverState: newState });
  }

  private start(): void {
    fetch(RecordingFields.startEndpoint).catch(console.error);
  }

  private stop(): void {
    fetch(RecordingFields.stopEndpoint).catch(console.error);
  }

  public render(_: unknown, state: RecordingFieldsState): ComponentChild {
    return (
      <form class="recording__editor">
        <fieldset class="recording__boundary">
          <legend>Beginning</legend>
          <Thumbnail
            src={state.serverState.startThumbnail} />
          <TimestampInput
            name="start-timestamp"
            value={state.serverState.startTimestamp} />
        </fieldset>
        <div className="recording__controls">
          <button type="button" onClick={this.start}>Start</button>
          <button type="button" onClick={this.stop}>Stop</button>
        </div>
        <fieldset class="recording__boundary">
          <legend>End</legend>
          <Thumbnail
            src={state.serverState.stopThumbnail} />
          <TimestampInput
            name="stop-timestamp"
            value={state.serverState.stopTimestamp} />
        </fieldset>
      </form>
    );
  }
}

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

const Thumbnail: FunctionalComponent<{ src: string | null }> =
({ src }): VNode => (
  <object
    data={src || ''}
    class="recording__thumbnail">
    <div class="recording__thumbnail-placeholder" />
  </object>
);
