import { h, VNode } from 'preact';
import { JSXInternal } from 'preact/src/jsx';

export type Props = JSXInternal.HTMLAttributes & {
  name: string;
  label: string;
};

export default function Icon({
  name,
  label,
  'class': className,
  ...additionalProps
}: Props): VNode {
  return (
    <svg
      {...additionalProps}
      class={`icon icon-${name} ${className || ''}`}
      title={label}
      aria-label={label}
    >
      <use href={`/icons/symbol/icons.svg#${name}`}></use>
    </svg>
  );
}
