/**
 * One day... https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
 * Firefox, get your shit together: https://bugzilla.mozilla.org/show_bug.cgi?id=840640
 */
import { h, FunctionalComponent, VNode, RenderableProps } from 'preact';
import { createPortal } from 'preact/compat';
import { useMemo } from 'preact/hooks';

type ModalProps = RenderableProps<{
  isOpen: boolean;
  onClose: () => void;
}>;

export const Modal: FunctionalComponent<ModalProps> = ({
  children,
  isOpen,
  onClose,
}): VNode | null => {
  // TODO: Trap keyboard focus
  const modalPortal = useMemo(() => document.getElementById('modals')) as HTMLDivElement;
  if (!isOpen) {
    return null;
  }
  return createPortal(
    <div className="modal__wrapper">
      <div class="modal__body">
        <button
          type="button"
          class="modal__close-button"
          title="Close"
          aria-label="Close Modal"
          onClick={onClose}
        >
          &times;
        </button>
        <div className="modal__scroll-box">
          <div className="modal__content">{children}</div>
        </div>
      </div>
    </div>,
    modalPortal,
  );
};
