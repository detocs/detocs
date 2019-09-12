import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';
import { capitalize } from '../../util/string';

interface Props {
  id: string;
  name?: string;
}

const Tab: FunctionalComponent<Props> = ({
  children,
  id,
  name = capitalize(id),
}: RenderableProps<Props>): VNode => {
  const inputId = `tab-${id}`;
  return(
    <section class="tabbable-section">
      <input
        type="radio"
        class="tabbable-section-control"
        id={inputId}
        name="main-tabs"
        hidden
      />
      <h2 class="tabbable-section__tab">
        <label for={inputId} role="presentation">{name}</label>
      </h2>
      {children}
    </section>
  );
};
export default Tab;
