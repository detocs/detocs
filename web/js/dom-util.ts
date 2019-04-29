export function cloneTemplate(id: string): DocumentFragment {
  const template = document.getElementById(id) as HTMLTemplateElement;
  return template.content.cloneNode(true) as DocumentFragment;
}
