import { h, render, Component, ComponentChild, VNode, FunctionalComponent } from 'preact';

import ServerState from '../../server/recording/state';

import { recordingEndpoint } from './api';

export default class RecordingFieldsElement extends HTMLElement {
  private static readonly nullState: ServerState = {
    recordingFolder: null,
    recordingFile: null,
    clipFile: null,
    startTimestamp: null,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
  };

  private componentElement?: Element;
  public state: Props = { serverState: RecordingFieldsElement.nullState };

  public constructor() {
    super();
    const ws = new WebSocket(recordingEndpoint('', 'ws:').href);
    ws.onmessage = this.updateServerState.bind(this);
    ws.onerror = console.error;
  }

  private updateServerState(ev: MessageEvent): void {
    this.state = { serverState: JSON.parse(ev.data) as ServerState };
    let tabElement = this.closest('.tabbable-section');
    tabElement = tabElement && tabElement.querySelector('.tabbable-section__tab label');
    if (tabElement) {
      tabElement.classList.toggle(
        'recording__tab-label--recording',
        !!this.state.serverState.startTimestamp && !this.state.serverState.stopTimestamp);
    }
    this.render();
  }

  private connectedCallback(): void {
    this.render();
  }

  public render(): void {
    this.componentElement = render(
      <RecordingFields {...this.state} />,
      this,
      this.componentElement
    );
  }
}

interface Props {
  serverState: ServerState;
}

class RecordingFields extends Component<Props> {
  private static readonly startEndpoint = recordingEndpoint('/start').href;
  private static readonly stopEndpoint = recordingEndpoint('/stop').href;

  private start(): void {
    fetch(RecordingFields.startEndpoint).catch(console.error);
  }

  private stop(): void {
    fetch(RecordingFields.stopEndpoint).catch(console.error);
  }

  public render(props: Props): ComponentChild {
    return (
      <form class="recording__editor">
        <fieldset class="recording__boundary">
          <legend>Beginning</legend>
          <Thumbnail
            src={props.serverState.startThumbnail} />
          <TimestampInput
            name="start-timestamp"
            value={props.serverState.startTimestamp} />
        </fieldset>
        <div className="recording__controls">
          <button type="button" onClick={this.start}>Start</button>
          <button type="button" onClick={this.stop}>Stop</button>
        </div>
        <fieldset class="recording__boundary">
          <legend>End</legend>
          <Thumbnail
            src={props.serverState.stopThumbnail} />
          <TimestampInput
            name="stop-timestamp"
            value={props.serverState.stopTimestamp} />
        </fieldset>
        <input
          readOnly
          value={props.serverState.clipFile || ''}
          placeholder="Output File"
          class="recording__file"
          dir="rtl" // TODO: This is a hack
        />
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
