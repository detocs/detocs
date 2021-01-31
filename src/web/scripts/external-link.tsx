import { h, FunctionalComponent } from 'preact';
import { JSXInternal } from 'preact/src/jsx';

const ExternalLink: FunctionalComponent<JSXInternal.HTMLAttributes> = ({
  children,
  ...attributes
}) => {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      {...attributes}
    >
      {children}
    </a>
  );
};
export default ExternalLink;
