import { Ref } from 'preact';
import { useRef, useState } from 'preact/hooks';

export default function useModalState(
  initiallyOpen=false,
): [ boolean, () => void, () => void, Ref<HTMLElement> ] {
  const triggerRef = useRef<HTMLElement>();
  const [ modalOpen, updateModalOpen ] = useState(initiallyOpen);
  const openModal = (): void => {
    updateModalOpen(true);
  };
  const closeModal = (): void => {
    updateModalOpen(false);
    triggerRef.current?.focus();
  };
  return [ modalOpen, openModal, closeModal, triggerRef ];
}
