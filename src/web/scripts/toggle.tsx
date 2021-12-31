import clsx from 'clsx';
import { h, VNode } from 'preact';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ToggleProps<T extends string> {
  name: string;
  options: ToggleOption<T>[];
  selected: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function Toggle<T extends string>({
  name,
  options,
  selected,
  onChange,
  disabled: componentDisabled,
}: ToggleProps<T>): VNode {
  return (
    <span class="toggle__container">
      {options.map(({ value, label, disabled }) =>
        <label class={clsx(
          'toggle__option',
          selected == value && 'toggle__option--selected',
          (componentDisabled || disabled) && 'toggle__option--disabled',
        )}>
          <input
            key={value}
            type="radio"
            name={name}
            value={value}
            onInput={() => onChange(value)}
            checked={selected == value}
            disabled={componentDisabled || disabled}
          />
          {' '}
          {label}
        </label>)}
    </span>
  );
}
