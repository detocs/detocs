import clsx from 'clsx';
import { h, FunctionalComponent, VNode, createRef, Fragment, Ref } from 'preact';
import { forwardRef } from 'preact/compat';
import { JSXInternal } from 'preact/src/jsx';

import { isVideoClip } from '@models/media';
import { ClipView, ClipStatus } from '@server/clip/state';
import { Id } from '@util/id';

import { CallbackForm } from './forms';
import { Modal, useModalState } from './modal';
import { Thumbnail } from './thumbnail';

export interface ClipSelectorProps {
  clips: ClipView[];
  onSelect: (clipId: string | null) => void;
  currentClipId?: Id | null;
  includeNone?: boolean;
}

export const ClipSelector: FunctionalComponent<ClipSelectorModalProps> = ({
  clips,
  onSelect,
  currentClipId,
  includeNone = true,
}): VNode => {
  const formRef = createRef<HTMLFormElement>();
  const submitForm = (): void => {
    setTimeout(() => formRef.current?.requestSubmit());
  };
  return (
    <CallbackForm<{ clipId: string }>
      class="clip-selector"
      formRef={formRef}
      onSubmit={data => {
        onSelect(data.clipId || null);
      }}
    >
      <input type="submit" hidden />
      <div class="clip-selector__list">
        { includeNone && <label
          key={'clearClip'}
          class={clsx(
            'clip-selector__option',
            currentClipId == null && 'clip-selector__option--selected',
          )}
        >
          <div class="clip-selector__clip-info" onClick={submitForm}>
            <Thumbnail />
            <div class="clip-selector__clip-description">None</div>
          </div>
          <input type="radio" name="clipId" value="" checked={currentClipId == null}/>
        </label> }
        {clips.slice().reverse().map(clipView => (
          <label
            key={clipView.clip.id}
            class={clsx(
              'clip-selector__option',
              currentClipId === clipView.clip.id && 'clip-selector__option--selected',
            )}
            aria-busy={clipView.status === ClipStatus.Rendering}
          >
            <input
              type="radio"
              name="clipId"
              value={clipView.clip.id}
              checked={currentClipId === clipView.clip.id}
            />
            <div class="clip-selector__clip-info" onClick={submitForm}>
              <Thumbnail
                media={clipView.clip.media}
                thumbnail={isVideoClip(clipView.clip) ? clipView.clip.thumbnail : undefined}
              />
              <div class="clip-selector__clip-description">
                {clipView.clip.description || ''}
              </div>
            </div>
          </label>
        ))}
      </div>
    </CallbackForm>
  );
};

export type ClipSelectorModalProps = ClipSelectorProps &
Omit<JSXInternal.HTMLAttributes<HTMLButtonElement>, 'onSelect'>;

export const ClipSelectorModal = forwardRef<HTMLButtonElement, ClipSelectorModalProps>(({
  children,
  clips,
  onSelect,
  currentClipId,
  ...attributes
}, forwardedRef): VNode => {
  const [ modalOpen, openModal, closeModal, triggerRef ] = useModalState(false);
  return (
    <Fragment>
      <button
        type="button"
        ref={mergeRefs<HTMLButtonElement>(triggerRef as Ref<HTMLButtonElement>, forwardedRef)}
        onClick={openModal}
        {...attributes}
      >
        {children}
      </button>
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <ClipSelector
          clips={clips}
          onSelect={clipId => {
            closeModal();
            onSelect(clipId);
          }}
          currentClipId={currentClipId}
        />
      </Modal>
    </Fragment>
  );
});

function mergeRefs<T>(...refs: (Ref<T> | null | undefined)[]): Ref<T> {
  return (element) => refs.forEach(ref => {
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  });
}

