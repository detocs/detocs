import { h, FunctionalComponent, VNode, RenderableProps, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { GetClipResponse } from '../../server/media-dashboard/server';
import {
  State as MediaDashbaordState,
  ClipStatus,
  ClipView,
} from '../../server/media-dashboard/state';
import ClientState from '../../server/twitter/client-state';
import { checkResponseStatus } from "../../util/ajax";

import { twitterEndpoint, mediaDashboardEndpoint } from './api';
import { Modal } from './modal';
import { PersistentCheckbox } from './persistent-checkbox';
import { Thumbnail } from './thumbnail';

interface Props {
  twitterState: ClientState;
  mediaDashboardState: MediaDashbaordState;
  thread: boolean;
  onThreadToggle: VoidFunction;
}

const tweetEndpoint = twitterEndpoint('/tweet').href;
const screenshotEndpoint = mediaDashboardEndpoint('/screenshot').href;

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  return fetch(
    tweetEndpoint,
    {
      method: 'POST',
      body: new FormData(form),
    })
    .catch(console.error)
    .then(() => { (form.querySelector('textarea') as HTMLTextAreaElement).value = ''; });
}

function takeScreenshot(): Promise<string> {
  return fetch(screenshotEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<GetClipResponse>)
    .then(resp => resp.id);
}

const TwitterDashboard: FunctionalComponent<Props> = ({
  twitterState,
  mediaDashboardState,
  thread,
  onThreadToggle,
}): VNode => {
  console.log(JSON.stringify(mediaDashboardState, null, 2));
  const [ clipId, updateClipId ] = useState<string | null>(null);
  const [ busy, updateBusy ] = useState(false);
  const clip = mediaDashboardState.clips.find(c => c.clip.id === clipId)?.clip || null;
  return (
    <form
      class="twitter__editor js-manual-form"
      aria-busy={busy}
      onSubmit={e => {
        updateBusy(true);
        onSubmit(e)
          .then(() => updateClipId(null))
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
            <span>Tweeting as {twitterState.user.name} ({twitterState.user.handle})</span>
          }
          <a href={twitterState.authorizeUrl} target="_blank" rel="noopener noreferrer">Log In</a>
        </span>
      </header>
      <div class="twitter__tweet-content">
        <textarea name="body" required {...{ maxlength: '280' }} autofocus={true}></textarea>
        <div className="twitter__tweet-media">
          <Thumbnail media={clip?.media} />
          <button type="button" onClick={() => takeScreenshot().then(updateClipId)}>
            Take Screenshot
          </button>
          <ClipSelector
            clips={mediaDashboardState.clips.filter(c => c.status === ClipStatus.Rendered)}
            onSelect={updateClipId}
          >
            Select Media
          </ClipSelector>
        </div>
      </div>
      <input type="hidden" name="media" value={clip?.media.url}/>
      <div class="input-row">
        <button type="submit">Tweet</button>
      </div>
    </form>
  );
};

interface ClipSelectorProps extends Omit<JSXInternal.HTMLAttributes, 'onSelect'> {
  clips: ClipView[];
  onSelect: (clipId: string | null) => void;
}

const ClipSelector: FunctionalComponent<RenderableProps<ClipSelectorProps>> = ({
  children,
  clips,
  onSelect,
  ...attributes
}): VNode => {
  const [ modalOpen, updateModalOpen ] = useState(false);
  const openModal = (): void => {
    updateModalOpen(true);
  };
  const closeModal = (): void => {
    updateModalOpen(false);
  };
  return (
    <Fragment>
      <button type="button" onClick={openModal} {...attributes}>{children}</button>
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <CallbackForm<{ clipId: string }>
          class="clip-selector js-manual-form"
          onSubmit={data => {
            closeModal();
            onSelect(data.clipId || null);
          }}
        >
          <div class="clip-selector__list">
            <label class="clip-selector__option">
              <div class="clip-selector__clip-info">
                <Thumbnail />
                <div class="clip-selector__clip-description">None</div>
              </div>
              <input type="radio" name="clipId" value=""/>
            </label>
            {clips.map(clipView => (
              <label class="clip-selector__option">
                <div class="clip-selector__clip-info">
                  <Thumbnail media={clipView.clip.media} />
                  <div class="clip-selector__clip-description">
                    {clipView.clip.description || ''}
                  </div>
                </div>
                <input type="radio" name="clipId" value={clipView.clip.id}/>
              </label>
            ))}
          </div>
          <div class="clip-selector__controls">
            <button type="submit">Select</button>
          </div>
        </CallbackForm>
      </Modal>
    </Fragment>
  );
};

type CallbackFormProps<T> = Omit<JSXInternal.HTMLAttributes, 'onSubmit'> & RenderableProps<{
  onSubmit: (formData: T) => void;
}>;

function CallbackForm<T>({
  children,
  onSubmit,
  ...attributes
}: CallbackFormProps<T>): VNode {
  const submitHandler = (event: Event): void => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    onSubmit(data as unknown as T);
  };
  return (
    <form
      {...attributes}
      onSubmit={submitHandler}
    >
      {children}
    </form>
  );
}

export default TwitterDashboard;
