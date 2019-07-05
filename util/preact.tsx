import { h, Ref, FunctionalComponent, RenderableProps, VNode } from "preact";

export interface RefObject<T> extends Ref<T> {
  current?: T;
}

export function createRef<T extends HTMLElement>(): RefObject<T> {
  const ref = function(elem: T): void {
    ref.current = elem;
  } as RefObject<T>;
  return ref;
}

export const Fragment: FunctionalComponent = ({ children }: RenderableProps<{}>): VNode => {
  return <span class="fragment">{children}</span>;
};
