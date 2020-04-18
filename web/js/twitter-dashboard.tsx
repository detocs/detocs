import { h, FunctionalComponent, VNode } from 'preact';

import { Clip } from '../../models/media';
import { State as MediaDashbaordState, ClipStatus } from '../../server/media-dashboard/state';
import ClientState from '../../server/twitter/client-state';
import { twitterEndpoint } from './api';
import { Thumbnail } from './thumbnail';
import { PersistentCheckbox } from './persistent-checkbox';

interface Props {
  twitterState: ClientState;
  mediaDashboardState: MediaDashbaordState;
  thread: boolean;
  onThreadToggle: VoidFunction;
}

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

const TwitterDashboard: FunctionalComponent<Props> = ({
  twitterState,
  mediaDashboardState,
  thread,
  onThreadToggle,
}): VNode => {
  const latestClip: Clip | undefined = mediaDashboardState.clips
    .filter(c => c.status === ClipStatus.Rendered)
    .slice(-1)[0]
    ?.clip;
  const mediaUrl = latestClip?.video.url;
  return (
    <form class="twitter__editor js-manual-form" onSubmit={onSubmit}>
      <header>
        <label>
          <PersistentCheckbox name="thread" checked={thread} onChange={onThreadToggle}/>
          Thread under previous tweet
        </label>
        <span>
          {twitterState.user &&
            <span>Tweeting as {twitterState.user.name} ({twitterState.user.handle})</span>
          }
          <a href={twitterState.authorizeUrl} target="_blank" rel="noopener noreferrer">Log In</a>
        </span>
      </header>
      <div class="input-row twitter__tweet-content">
        <textarea name="body" required {...{ maxlength: '280' }} autofocus={true}></textarea>
        <Thumbnail src={mediaUrl || null} />
      </div>
      <input type="hidden" name="media" value={mediaUrl}/>
      <div class="input-row">
        <button type="submit">Tweet</button>
        <button type="button" onClick={takeScreenshot}>Take Screenshot</button>
      </div>
    </form>
  );
};
export default TwitterDashboard;
