import { h, FunctionalComponent, RenderableProps, VNode } from "preact";

const RecordingDashboard: FunctionalComponent = ({}: RenderableProps<{}>): VNode => {
  return(
    // @ts-ignore
    <recording-fields class="tabbable-section-content"></recording-fields>
  );
};
export default RecordingDashboard;
