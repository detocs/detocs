import { h, FunctionalComponent, RenderableProps, VNode, createRef, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { ClipView, ClipStatus } from '../../server/clip/state';
import { Id } from '../../util/id';

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
      class="clip-selector js-manual-form"
      formRef={formRef}
      onSubmit={data => {
        onSelect(data.clipId || null);
      }}
    >
      <input type="submit" hidden />
      <div class="clip-selector__list">
        { includeNone && <label class="clip-selector__option">
          <div class="clip-selector__clip-info" onClick={submitForm}>
            <Thumbnail />
            <div class="clip-selector__clip-description">None</div>
          </div>
          <input type="radio" name="clipId" value="" checked={currentClipId == null}/>
        </label> }
        {clips.slice().reverse().map(clipView => (
          <label class="clip-selector__option" aria-busy={clipView.status === ClipStatus.Rendering}>
            <div class="clip-selector__clip-info" onClick={submitForm}>
              <Thumbnail media={clipView.clip.media} />
              <div class="clip-selector__clip-description">
                {clipView.clip.description || ''}
              </div>
            </div>
            <input
              type="radio"
              name="clipId"
              value={clipView.clip.id}
              checked={currentClipId === clipView.clip.id}
              disabled={clipView.status === ClipStatus.Rendering}
            />
          </label>
        ))}
      </div>
    </CallbackForm>
  );
};

export type ClipSelectorModalProps = ClipSelectorProps &
Omit<JSXInternal.HTMLAttributes, 'onSelect'>;

export const ClipSelectorModal: FunctionalComponent<RenderableProps<ClipSelectorModalProps>> = ({
  children,
  clips,
  onSelect,
  currentClipId,
  ...attributes
}): VNode => {
  const [ modalOpen, openModal, closeModal, triggerRef ] = useModalState(false);
  return (
    <Fragment>
      <button
        type="button"
        ref={triggerRef}
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
};
