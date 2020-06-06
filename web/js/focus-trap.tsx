import { h, RenderableProps, FunctionalComponent, VNode } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { INTERACTIVE_SELECTOR, keyHandler, Key } from '../../util/dom';

type FocusTrapProps = RenderableProps<{}> & JSXInternal.HTMLAttributes;

const FocusTrap: FunctionalComponent<FocusTrapProps> = ({ children, ...attributes }): VNode => {
  const ref = useRef<HTMLElement>();
  let firstInteractible: HTMLElement | undefined;
  let lastInteractible: HTMLElement | undefined;
  useEffect(() => {
    const interactibles = ref.current?.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR);
    if (interactibles && interactibles.length > 0) {
      firstInteractible = interactibles[0];
      lastInteractible = interactibles[interactibles.length - 1];
    }
  }, [ children ]);
  const handleTab = (evt: KeyboardEvent): void => {
    if (!evt.shiftKey && document.activeElement === lastInteractible) {
      firstInteractible?.focus();
      evt.preventDefault();
    }
    if (evt.shiftKey && document.activeElement === firstInteractible) {
      lastInteractible?.focus();
      evt.preventDefault();
    }
  };
  // TODO: ForwardRef
  return (
    <div
      {...attributes}
      ref={ref}
      onKeyDown={keyHandler({ [Key.Tab]: handleTab })}
    >
      {children}
    </div>
  );
};
export default FocusTrap;
