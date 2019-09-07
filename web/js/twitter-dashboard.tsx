import { h, render, Component, ComponentChild } from 'preact';

import ClientState, { nullState } from '../../server/twitter/client-state';

import { twitterEndpoint } from './api';
import { Thumbnail } from './thumbnail';

export default class TwitterDashboardElement extends HTMLElement {
  private componentElement?: Element;
  public state: Props = nullState;

  public constructor() {
    super();
    const ws = new WebSocket(twitterEndpoint('', 'ws:').href);
    ws.onmessage = this.updateServerState.bind(this);
    ws.onerror = console.error;
  }

  private updateServerState(ev: MessageEvent): void {
    this.state = JSON.parse(ev.data) as ClientState;
    this.render();
  }

  private connectedCallback(): void {
    this.render();
  }

  public render(): void {
    this.componentElement = render(
      <TwitterDashboard {...this.state} />,
      this,
      this.componentElement
    );
  }
}

type Props = ClientState;

class TwitterDashboard extends Component<Props> {
  private static readonly tweetEndpoint = twitterEndpoint('/tweet').href;
  private static readonly screenshotEndpoint = twitterEndpoint('/take_screenshot').href;

  private onSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    fetch(
      TwitterDashboard.tweetEndpoint,
      {
        method: 'POST',
        body: new FormData(form),
      })
      .catch(console.error)
      .then(() => { form.reset(); });
  }

  private takeScreenshot(): void {
    fetch(TwitterDashboard.screenshotEndpoint, { method: 'POST' })
      .catch(console.error);
  }

  public render(props: Props): ComponentChild {
    return (
      <form class="twitter__editor" onSubmit={this.onSubmit}>
        <header>
          {props.user &&
            <span>Tweeting as {props.user.name} ({props.user.handle})</span>
          }
          <a href={props.authorizeUrl} target="_blank" rel="noopener noreferrer">Log In</a>
        </header>
        <textarea name="body" {...{ maxlength: '280' }}></textarea>
        <Thumbnail src={props.screenshot} />
        <input type="hidden" name="image" value={props.screenshot || undefined}/>
        <button type="button" onClick={this.takeScreenshot}>Take Screenshot</button>
        <button type="submit">Tweet</button>
      </form>
    );
  }
}
