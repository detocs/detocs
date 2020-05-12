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
  const contentId = `${id}`;
  return(
    <div class="tabbable-section">
      <input
        type="radio"
        name="main-tabs"
        id={inputId}
        class="tabbable-section__control sr-only"
        role="tab"
        aria-controls={contentId}
        aria-label={name}
      />
      <h2 class="tabbable-section__tab">
        <label for={inputId} role="presentation">{name}</label>
      </h2>
      <div
        id={contentId}
        class="tabbable-section__content"
        role="tabpanel"
      >
        {children}
      </div>
    </div>
  );
};
export default Tab;
