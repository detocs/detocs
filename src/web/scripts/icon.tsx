import { h, VNode } from 'preact';
import { JSXInternal } from 'preact/src/jsx';

const ICON_NAME_MAPPING = Object.freeze({
  'more': 'dots-circle-horizontal',
  'close': 'x-circle',
});

export type Props = JSXInternal.SVGAttributes<SVGSVGElement> & {
  name: keyof typeof ICON_NAME_MAPPING;
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
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <use href={`/icons/symbol/icons.svg#${ICON_NAME_MAPPING[name]}`}></use>
    </svg>
  );
}
