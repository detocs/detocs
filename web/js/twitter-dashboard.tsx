import { h, FunctionalComponent, VNode, RenderableProps, Fragment, createRef, Ref } from 'preact';
import { useState } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { GetClipResponse } from '../../server/clip/server';
import {
  State as ClipState,
  ClipStatus,
  ClipView,
} from '../../server/clip/state';
import ClientState from '../../server/twitter/client-state';
import { checkResponseStatus } from "../../util/ajax";

import { twitterEndpoint, clipEndpoint } from './api';
import { Modal } from './modal';
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
          .catch(console.error)
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
              () => takeScreenshot().then(updateClipId).catch(console.error)
            }>
              Take Screenshot
            </button>
            <ClipSelector
              clips={clipState.clips.filter(c => c.status === ClipStatus.Rendered)}
              onSelect={updateClipId}
            >
              Select Media
            </ClipSelector>
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
  const formRef = createRef<HTMLFormElement>();
  return (
    <Fragment>
      <button type="button" onClick={openModal} {...attributes}>{children}</button>
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <CallbackForm<{ clipId: string }>
          class="clip-selector js-manual-form"
          formRef={formRef}
          onClick={(evt: Event) => {
            if (evt.target instanceof HTMLInputElement) {
              formRef.current?.requestSubmit();
            }
          }}
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
            {clips.slice().reverse().map(clipView => (
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
        </CallbackForm>
      </Modal>
    </Fragment>
  );
};

type CallbackFormProps<T> = Omit<JSXInternal.HTMLAttributes, 'onSubmit'> & RenderableProps<{
  onSubmit: (formData: T) => void;
  formRef: Ref<HTMLFormElement>;
}>;

function CallbackForm<T>({
  children,
  onSubmit,
  formRef,
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
      ref={formRef}
    >
      {children}
    </form>
  );
}

export default TwitterDashboard;
