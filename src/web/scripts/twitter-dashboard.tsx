import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo, StateUpdater } from 'preact/hooks';
import twitterText from 'twitter-text';

import { GetClipResponse } from '@server/clip/server';
import {
  State as ClipState,
  ClipStatus,
  isVideoClipView,
} from '@server/clip/state';
import ClientState from '@server/twitter/client-state';
import { checkResponseStatus } from '@util/ajax';
import { inputHandler } from '@util/dom';

import { twitterEndpoint, clipEndpoint } from './api';
import { ClipSelectorModal } from './clip-selector';
import useId from './hooks/id';
import { logError } from './log';
import { Thumbnail } from './thumbnail';
import Toggle from './toggle';
import { useSessionStorage } from './hooks/storage';

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

type SubmitEvent = Event & {
  submitter?: HTMLButtonElement;
};

type DashboardMode = 'single' | 'thread';

const tweetEndpoint = twitterEndpoint('/tweet').href;
const loginEndpoint = twitterEndpoint('/login').href;
const screenshotEndpoint = clipEndpoint('/screenshot').href;

async function submitForm(
  form: HTMLFormElement,
  additionalParams: Record<string, string>
): Promise<Response> {
  const body = new FormData(form);
  Object.entries(additionalParams)
    .forEach(([key, value]) => body.append(key, value));
  return fetch(
    tweetEndpoint,
    {
      method: 'POST',
      body,
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selectMediaRef = useRef<HTMLButtonElement>(null);
  const [ mode, setMode ] = useSessionStorage<DashboardMode>('twitter-mode', 'single');
  const [ body, setBody ] = useState('');
  const [ clipId, setClipId ] = useState<string | null>(null);
  const clipView = clipState.clips.find(c => c.clip.id === clipId) || null;
  const [ busy, setBusy ] = useState(false);
  const { charCount, error: charCountError } = useMemo(() => validateTweetBody(body), [ body ]);
  const renderingError = clipView?.status === ClipStatus.Rendering ?
    'Clip is still rendering' :
    '';
  const emptyError = !body?.trim() && !clipId ? 'Media or tweet body must be provided' : '';
  const bodyError = emptyError || charCountError;
  const mediaError = renderingError;
  useEffect(() => {
    bodyRef.current?.setCustomValidity(bodyError);
  }, [ bodyError ]);
  useEffect(() => {
    selectMediaRef.current?.setCustomValidity(mediaError);
  }, [ mediaError ]);
  const textHandler = inputHandler(setBody);
  const loggedIn = !!twitterState.user;
  return (
    <form
      class="twitter__editor js-manual-form"
      aria-busy={busy}
      onSubmit={(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement;
        let params = { thread: '', forget: '' };
        switch ((event.submitter as HTMLButtonElement | null)?.value ||
          (document.activeElement as HTMLButtonElement | null)?.value)
        {
          case 'unthreaded':
            params = { thread: '', forget: 'yes' };
            break;
          case 'new-thread':
            params = { thread: '', forget: '' };
            break;
          case 'continue-thread':
            params = { thread: 'yes', forget: '' };
            break;
        }
        setBusy(true);
        submitForm(form, params)
          .then(() => {
            setBody('');
            setClipId(null);
          })
          .catch(logError)
          .finally(() => setBusy(false));
      }}
    >
      <header>
        <div>
          <span>Mode:</span>
          {' '}
          <Toggle<DashboardMode>
            name="mode"
            options={[
              { value: 'single', label: 'Individual Tweets'},
              { value: 'thread', label: 'Threads'},
            ]}
            selected={mode}
            onChange={setMode}
            disabled={!loggedIn}
          />
        </div>
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
            <div className="twitter__tweet-controls input-row">
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
              {mode == 'thread'
                ? <div class="action-row">
                  <button
                    type="submit"
                    name="action"
                    value="unthreaded"
                  >
                    One-off
                  </button>
                  <button
                    type="submit"
                    name="action"
                    value="new-thread"
                    ref={selectMediaRef}
                  >
                    Start Thread
                  </button>
                  <button
                    type="submit"
                    name="action"
                    value="continue-thread"
                    disabled={!twitterState.lastTweetId}
                  >
                    Continue Thread
                  </button>
                </div>
                : <button
                  type="submit"
                  name="action"
                  value="new-thread"
                  ref={selectMediaRef}
                >
                  Tweet
                </button>
              }
            </div>
          </div>
          <TwitterMedia {...{
            clipState,
            clipId,
            setClipId,
            mediaError,
          }} />
        </div>
      </fieldset>
    </form>
  );
};

interface MediaProps {
  clipState: ClipState;
  clipId: string | null;
  setClipId: StateUpdater<string | null>;
  mediaError: string;
}

const TwitterMedia: FunctionalComponent<MediaProps> = ({
  clipState,
  clipId,
  setClipId,
  mediaError,
}): VNode => {
  const clipView = clipState.clips.find(c => c.clip.id === clipId) || null;
  const previewRef = useRef<HTMLOutputElement>(null);
  const [ mediaInputId ] = useId(1, 'twitter-media-');
  useEffect(() => {
    previewRef.current?.setCustomValidity(mediaError);
  }, [ mediaError ]);
  return (
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
          thumbnail={(clipView && isVideoClipView(clipView))
            ? clipView.clip.thumbnail
            : undefined
          }
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
