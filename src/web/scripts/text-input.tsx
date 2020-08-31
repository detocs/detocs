import { h, ComponentChildren } from 'preact';
import { forwardRef } from 'preact/compat'

import useId from './hooks/id';
import { JSXInternal } from 'preact/src/jsx';

export type Props = JSXInternal.HTMLAttributes & {
  label: ComponentChildren;
};

const TextInput = forwardRef<HTMLInputElement, Props>(({
  label,
  'class': className,
  ...additionalProps
}, ref) => {
  const [ inputId ] = useId(1, 'input-');
  return (
    <span class={'textInput ' + (className || '')}>
      <input
        ref={ref}
        class="textInput__input"
        placeholder={label}
        {...additionalProps}
      />
      <label for={inputId} class="textInput__label">{label}</label>
    </span>
  );
});
export default TextInput;
