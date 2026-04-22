import { h, FunctionalComponent, JSX } from 'preact';

const ExternalLink: FunctionalComponent<JSX.HTMLAttributes> = ({
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
