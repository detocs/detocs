import { h, FunctionalComponent, RenderableProps, VNode } from "preact";

export const Fragment: FunctionalComponent = ({ children }: RenderableProps<{}>): VNode => {
  return <span class="fragment">{children}</span>;
};
