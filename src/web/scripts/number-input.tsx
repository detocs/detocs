import clsx from 'clsx';
import { h } from 'preact';
import { forwardRef } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import Icon from './icon';
import { mergeRefs } from './refs';

export type Props = JSXInternal.HTMLAttributes<HTMLInputElement>;

const NumberInput = forwardRef<HTMLInputElement, Props>(({
  'class': className,
  ...attrs
}, externalRef) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span
      class={clsx('number-input', className)}
    >
      <input
        {...attrs}
        ref={mergeRefs(externalRef, ref)}
        type="number"
        class="number-input__input"
      />
      <span class="number-input__buttons">
        <button
          type="button"
          class="number-input__button number-input__button--increment"
          onClick={() => {
            if (ref.current) {
              ref.current.stepUp();
              const ev = new Event('input', { bubbles: true });
              ref.current.dispatchEvent(ev);
            }
          }}
        >
          <Icon name="plus" label="Increment" />
        </button>
        <button
          type="button"
          class="number-input__button number-input__button--decrement"
          onClick={() => {
            if (ref.current) {
              ref.current.stepDown();
              const ev = new Event('input', { bubbles: true });
              ref.current.dispatchEvent(ev);
            }
          }}
        >
          <Icon name="minus" label="Decrement" />
        </button>
      </span>
    </span>
  );
});
export default NumberInput;
