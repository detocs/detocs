import { JSX } from "preact";

export function cloneTemplate(id: string): DocumentFragment {
  const template = document.getElementById(id) as HTMLTemplateElement;
  return template.content.cloneNode(true) as DocumentFragment;
}

export function inputHandler(fn: (value: string) => void): JSX.EventHandler<Event> {
  return (e: Event) => fn((e.target as HTMLInputElement).value);
}
