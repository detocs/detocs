import { h, RenderableProps, FunctionalComponent, VNode } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { INTERACTIVE_SELECTOR, keyHandler, Key } from '@util/dom';

type FocusTrapProps = RenderableProps<Record<string, unknown>> &
JSXInternal.HTMLAttributes<HTMLDivElement>;

const FocusTrap: FunctionalComponent<FocusTrapProps> = ({ children, ...attributes }): VNode => {
  const ref = useRef<HTMLDivElement>(null);
  const firstInteractible = useRef<HTMLElement|null>(null);
  const lastInteractible = useRef<HTMLElement|null>(null);
  useEffect(() => {
    const interactibles = ref.current?.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR);
    if (interactibles && interactibles.length > 0) {
      firstInteractible.current = interactibles[0];
      lastInteractible.current = interactibles[interactibles.length - 1];
    }
  }, [ children ]);
  const handleTab = (evt: KeyboardEvent): void => {
    // TODO: This approach doesn't work with radio buttons, should switch to one using canaries
    if (!evt.shiftKey && document.activeElement === lastInteractible.current) {
      firstInteractible.current?.focus();
      evt.preventDefault();
    }
    if (evt.shiftKey && document.activeElement === firstInteractible.current) {
      lastInteractible.current?.focus();
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
