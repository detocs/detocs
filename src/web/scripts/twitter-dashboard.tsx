import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
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
import useId from './hooks/id';
import { useToggle } from './hooks/toggle';
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
}

const tweetEndpoint = twitterEndpoint('/tweet').href;
const loginEndpoint = twitterEndpoint('/login').href;
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
}): VNode => {
  const bodyRef = useRef<HTMLTextAreaElement>();
  const previewRef = useRef<HTMLOutputElement>();
  const selectMediaRef = useRef<HTMLButtonElement>();
  const [ mediaInputId ] = useId(1, 'twitter-media-');
  const [ body, setBody ] = useState('');
  const [ clipId, setClipId ] = useState<string | null>(null);
  const clipView = clipState.clips.find(c => c.clip.id === clipId) || null;
  const [ thread, toggleThread ] = useToggle(false);
  const [ busy, setBusy ] = useState(false);
  const { charCount, error: charCountError } = useMemo(() => validateTweetBody(body), [ body ]);
  const renderingError = clipView?.status === ClipStatus.Rendering ?
    'Clip is still rendering' :
    '';
  const emptyError = !body?.trim() && !clipId ? 'Media or tweet body must be provided' : '';
  const bodyError = emptyError || charCountError;
  const mediaError = emptyError || renderingError;
  useEffect(() => {
    bodyRef.current?.setCustomValidity(bodyError);
  }, [ bodyError ]);
  useEffect(() => {
    previewRef.current?.setCustomValidity(mediaError);
    selectMediaRef.current?.setCustomValidity(mediaError);
  }, [ mediaError ]);
  const textHandler = inputHandler(setBody);
  const loggedIn = !!twitterState.user;
  return (
    <form
      class="twitter__editor js-manual-form"
      aria-busy={busy}
      onSubmit={event => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        setBusy(true);
        submitForm(form)
          .then(() => {
            setBody('');
            setClipId(null);
          })
          .catch(logError)
          .finally(() => setBusy(false));
      }}
    >
      <header>
        <label>
          <PersistentCheckbox
            name="thread"
            checked={thread && !!twitterState.lastTweetId}
            onChange={toggleThread}
            disabled={!twitterState.lastTweetId}
          />
          Thread under previous tweet
        </label>
        <TwitterUserStatus {...twitterState} />
      </header>
      <fieldset disabled={!loggedIn}>
        <div class="twitter__tweet-content">
          <div className="twitter__tweet-body">
            <textarea
              class="twitter__tweet-text"
              name="body"
              value={body}
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
              <button type="submit" ref={selectMediaRef}>Tweet</button>
            </div>
          </div>
          <div className="twitter__tweet-media">
            <input
              id={mediaInputId}
              type="hidden"
              name="media"
              value={clipView?.clip.media.url || ''}
            />
            <output
              className="twitter__tweet-media-preview"
              ref={previewRef}
              for={mediaInputId}
            >
              <Thumbnail
                media={clipView?.clip.media}
                aria-busy={clipView?.status === ClipStatus.Rendering}
              />
            </output>
            <div className="twitter__tweet-media-actions action-row">
              <button type="button" onClick={
                () => takeScreenshot().then(setClipId).catch(logError)
              }>
                Take Screenshot
              </button>
              <ClipSelectorModal
                clips={clipState.clips.filter(c =>
                  c.status === ClipStatus.Rendered ||
                  c.status === ClipStatus.Rendering)}
                onSelect={setClipId}
                currentClipId={clipId}
              >
                Select Media
              </ClipSelectorModal>
            </div>
          </div>
        </div>
      </fieldset>
    </form>
  );
};

const TwitterUserStatus: FunctionalComponent<ClientState> = ({
  hasCredentials,
  user,
}): VNode => {
  if (!hasCredentials) {
    return <span>No Twitter credentials configured.</span>;
  }
  return (
    <span>
      {user ?
        <Fragment>
          Tweeting as {user.name}
          {' '}
          (<a href={user.url} target="_blank" rel="noopener noreferrer">
            @{user.handle}
          </a>).
        </Fragment>
        :
        'Not logged in.'
      }
      {' '}
      {isLocal() &&
        <a
          href={loginEndpoint}
          target="_blank"
          rel="noopener noreferrer"
        >
          Log In
        </a>
      }
    </span>
  );
};

function validateTweetBody(text: string): { charCount: number; error: string } {
  const parsed = twitterText.parseTweet(text);
  return {
    charCount: parsed.weightedLength,
    error: parsed.valid || !text.trim() ? '' : 'Invalid tweet',
  };
}

function isLocal(): boolean {
  return window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
}

export default TwitterDashboard;
