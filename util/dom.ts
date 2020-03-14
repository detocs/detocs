import { JSX } from "preact";

export const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), button, a, select, textarea, [tabindex]:not([tabindex="-2"])';

export function cloneTemplate(id: string): DocumentFragment {
  const template = document.getElementById(id) as HTMLTemplateElement;
  return template.content.cloneNode(true) as DocumentFragment;
}

export function inputHandler(fn: (value: string) => void): JSX.EventHandler<Event> {
  return (e: Event) => fn((e.target as HTMLInputElement).value);
}
