import { h, Component, ComponentChild } from 'preact';

import ClientState from '../../server/twitter/client-state';

import { twitterEndpoint } from './api';
import { Thumbnail } from './thumbnail';
import { PersistentCheckbox } from './persistent-checkbox';

type Props = ClientState & {
  thread: boolean;
  onThreadToggle: VoidFunction;
};

export default class TwitterDashboard extends Component<Props> {
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
      .then(() => { (form.querySelector('textarea') as HTMLTextAreaElement).value = ''; });
  }

  private takeScreenshot(): void {
    fetch(TwitterDashboard.screenshotEndpoint, { method: 'POST' })
      .catch(console.error);
  }

  public render(props: Props): ComponentChild {
    return (
      <form class="twitter__editor tabbable-section-content" onSubmit={this.onSubmit}>
        <header>
          <span>
            <PersistentCheckbox name="thread" checked={props.thread} onChange={props.onThreadToggle}/>
            Thread under previous tweet
          </span>
          <span>
            {props.user &&
              <span>Tweeting as {props.user.name} ({props.user.handle})</span>
            }
            <a href={props.authorizeUrl} target="_blank" rel="noopener noreferrer">Log In</a>
          </span>
        </header>
        <div class="input-row">
          <textarea name="body" required {...{ maxlength: '280' }}></textarea>
          <Thumbnail src={props.screenshot} />
        </div>
        <input type="hidden" name="image" value={props.screenshot || undefined}/>
        <div class="input-row">
          <button type="submit">Tweet</button>
          <button type="button" onClick={this.takeScreenshot}>Take Screenshot</button>
        </div>
      </form>
    );
  }
}
