export function cloneTemplate(id: string, container: HTMLElement): void {
  const template = document.getElementById(id) as HTMLTemplateElement;
  container.appendChild(template.content.cloneNode(true));
}
