import { h, VNode } from 'preact';
import { JSXInternal } from 'preact/src/jsx';

const ICON_NAME_MAPPING = Object.freeze({
  'close': 'x-circle',
  'dropdown-closed': 'chevron-down',
  'dropdown-open': 'chevron-up',
  'external': 'external-link',
  'more': 'dots-circle-horizontal',
});

export type Props = JSXInternal.SVGAttributes<SVGSVGElement> & {
  name: keyof typeof ICON_NAME_MAPPING;
  label?: string;
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
      {label && <title>{label}</title>}
      <use href={`/icons/symbol/icons.svg#${ICON_NAME_MAPPING[name]}`}></use>
    </svg>
  );
}
