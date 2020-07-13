import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import twitterText, { ParseTweetOptions } from 'twitter-text';

import { GetClipResponse } from '@server/clip/server';
import {
  State as ClipState,
  ClipStatus,
} from '@server/clip/state';
import ClientState from '@server/twitter/client-state';
import { checkResponseStatus } from '@util/ajax';
import { inputHandler } from '@util/dom';

import { twitterEndpoint, clipEndpoint } from './api';
import { ClipSelectorModal } from './clip-selector';
import { logError } from './log';
import { PersistentCheckbox } from './persistent-checkbox';
import { Thumbnail } from './thumbnail';

declare module 'twitter-text' {
  export const configs: {
    version1: Required<ParseTweetOptions>;
    version2: Required<ParseTweetOptions>;
    version3: Required<ParseTweetOptions>;
    defaults: Required<ParseTweetOptions>;
  };
}

const maxTweetLength = twitterText.configs.defaults.maxWeightedTweetLength;

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
  const bodyRef = useRef<HTMLTextAreaElement>();
  const [ charCount, setCharCount ] = useState(0);
  const [ error, setError ] = useState('');
  const [ clipId, updateClipId ] = useState<string | null>(null);
  const [ busy, updateBusy ] = useState(false);
  useEffect(() => {
    bodyRef.current?.setCustomValidity(error);
  }, [ error ]);
  const clip = clipState.clips.find(c => c.clip.id === clipId)?.clip || null;
  const textHandler = inputHandler(text => {
    validateTweetBody(setCharCount, setError, text);
  });
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
            validateTweetBody(setCharCount, setError, '');
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
        <div className="twitter__tweet-body">
          <textarea
            class="twitter__tweet-text"
            name="body"
            autofocus={true}
            ref={bodyRef}
            onInput={textHandler}
            onChange={textHandler}
          />
          <div className="twitter__tweet-controls">
            <meter
              aria-label="Tweet length"
              max={maxTweetLength + 1}
              high={maxTweetLength}
              low={maxTweetLength * 0.8}
              value={charCount}
            >
              {charCount}/{maxTweetLength}
            </meter>

            {maxTweetLength - charCount} remaining
            <button type="submit">Tweet</button>
          </div>
        </div>
        <div className="twitter__tweet-media">
          <input type="hidden" name="media" value={clip?.media.url}/>
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
    </form>
  );
};

function validateTweetBody(
  setCharCount: (count: number) => void,
  setError: (error: string) => void,
  text: string,
): void {
  const parsed = twitterText.parseTweet(text);
  setCharCount(parsed.weightedLength);
  if (!parsed.valid) {
    setError('Invalid tweet');
  } else {
    setError('');
  }
}

export default TwitterDashboard;
