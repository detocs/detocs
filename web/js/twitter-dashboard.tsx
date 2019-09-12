import { h, FunctionalComponent, RenderableProps, VNode } from "preact";

const TwitterDashboard: FunctionalComponent = ({}: RenderableProps<{}>): VNode => {
  return(
    // @ts-ignore
    <twitter-dashboard class="tabbable-section-content"></twitter-dashboard>
  );
};
export default TwitterDashboard;
