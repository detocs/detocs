import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useState } from 'preact/hooks';

import { GetClipResponse } from '@server/clip/server';
import {
  State as ClipState,
  ClipStatus,
} from '@server/clip/state';
import ClientState from '@server/twitter/client-state';
import { checkResponseStatus } from "../../util/ajax";

import { twitterEndpoint, clipEndpoint } from './api';
import { ClipSelectorModal } from './clip-selector';
import { logError } from './log';
import { PersistentCheckbox } from './persistent-checkbox';
import { Thumbnail } from './thumbnail';

interface Props {
  twitterState: ClientState;
  clipState: ClipState;
  thread: boolean;
  onThreadToggle: VoidFunction;
}

const tweetEndpoint = twitterEndpoint('/tweet').href;
const screenshotEndpoint = clipEndpoint('/screenshot').href;

async function submitForm(form: HTMLFormElement): Promise<Response> {
  return fetch(
    tweetEndpoint,
    {
      method: 'POST',
      body: new FormData(form),
    })
    .then(checkResponseStatus);
}

function takeScreenshot(): Promise<string> {
  return fetch(screenshotEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<GetClipResponse>)
    .then(resp => resp.id);
}

const TwitterDashboard: FunctionalComponent<Props> = ({
  twitterState,
  clipState,
  thread,
  onThreadToggle,
}): VNode => {
  const [ clipId, updateClipId ] = useState<string | null>(null);
  const [ busy, updateBusy ] = useState(false);
  const clip = clipState.clips.find(c => c.clip.id === clipId)?.clip || null;
  return (
    <form
      class="twitter__editor js-manual-form"
      aria-busy={busy}
      onSubmit={event => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        updateBusy(true);
        submitForm(form)
          .then(() => {
            updateClipId(null);
            (form.querySelector('textarea') as HTMLTextAreaElement).value = '';
          })
          .catch(logError)
          .finally(() => updateBusy(false));
      }}
    >
      <header>
        <label>
          <PersistentCheckbox name="thread" checked={thread} onChange={onThreadToggle}/>
          Thread under previous tweet
        </label>
        <span>
          {twitterState.user &&
            <Fragment>
              Tweeting as {twitterState.user.name}
              {' '}
              (<a href={twitterState.user.url} target="_blank" rel="noopener noreferrer">
                @{twitterState.user.handle}
              </a>)
            </Fragment>
          }
          {' '}
          <a href={twitterState.authorizeUrl} target="_blank" rel="noopener noreferrer">Log In</a>
        </span>
      </header>
      <div class="twitter__tweet-content">
        <textarea name="body" required {...{ maxlength: '280' }} autofocus={true}></textarea>
        <div className="twitter__tweet-media">
          <Thumbnail media={clip?.media} />
          <div className="twitter__tweet-media-actions input-row">
            <button type="button" onClick={
              () => takeScreenshot().then(updateClipId).catch(logError)
            }>
              Take Screenshot
            </button>
            <ClipSelectorModal
              clips={clipState.clips.filter(c =>
                c.status === ClipStatus.Rendered ||
                c.status === ClipStatus.Rendering)}
              onSelect={updateClipId}
              currentClipId={clipId}
            >
              Select Media
            </ClipSelectorModal>
          </div>
        </div>
      </div>
      <input type="hidden" name="media" value={clip?.media.url}/>
      <div class="input-row">
        <button type="submit">Tweet</button>
      </div>
    </form>
  );
};

export default TwitterDashboard;
