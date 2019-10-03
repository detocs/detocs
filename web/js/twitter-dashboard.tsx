import { h, FunctionalComponent, VNode } from 'preact';

import ClientState from '../../server/twitter/client-state';
import { twitterEndpoint } from './api';
import { Thumbnail } from './thumbnail';
import { PersistentCheckbox } from './persistent-checkbox';

type Props = ClientState & {
  thread: boolean;
  onThreadToggle: VoidFunction;
};

const tweetEndpoint = twitterEndpoint('/tweet').href;
const screenshotEndpoint = twitterEndpoint('/take_screenshot').href;

function onSubmit(event: Event): void {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  fetch(
    tweetEndpoint,
    {
      method: 'POST',
      body: new FormData(form),
    })
    .catch(console.error)
    .then(() => { (form.querySelector('textarea') as HTMLTextAreaElement).value = ''; });
}

function takeScreenshot(): void {
  fetch(screenshotEndpoint, { method: 'POST' })
    .catch(console.error);
}

const TwitterDashboard: FunctionalComponent<Props> = (props): VNode => {
  return (
    <form class="twitter__editor" onSubmit={onSubmit}>
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
      <div class="input-row twitter__tweet-content">
        <textarea name="body" required {...{ maxlength: '280' }}></textarea>
        <Thumbnail src={props.screenshot} />
      </div>
      <input type="hidden" name="image" value={props.screenshot || undefined}/>
      <div class="input-row">
        <button type="submit">Tweet</button>
        <button type="button" onClick={takeScreenshot}>Take Screenshot</button>
      </div>
    </form>
  );
};
export default TwitterDashboard;
