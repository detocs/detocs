import { JSX } from 'preact';
import { Key } from 'w3c-keys';
export { Key } from 'w3c-keys';

type KeyEventHandler = (event: KeyboardEvent) => unknown;
type KeyHandlerRecord = Partial<Record<Key, KeyEventHandler>>;

export const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), button, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

export function cloneTemplate(id: string): DocumentFragment {
  const template = document.getElementById(id) as HTMLTemplateElement;
  return template.content.cloneNode(true) as DocumentFragment;
}

export function inputHandler(fn: (value: string) => void): JSX.EventHandler<Event> {
  return (e: Event) => fn((e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

export function keyHandler(
  handlers: Map<Key | Key[], KeyEventHandler> | KeyHandlerRecord,
): KeyEventHandler {
  const entries: [string | string[], KeyEventHandler][] = handlers instanceof Map ?
    Array.from(handlers.entries()) :
    Object.entries(handlers) as [string, KeyEventHandler][];
  return event => {
    entries
      .filter(([keys]) => {
        if (typeof keys === 'string') {
          return keys === event.key;
        } else {
          return keys.includes(event.key);
        }
      })
      .forEach(([, handler]) => handler(event));
  };
}

export function ancestors(elem: Element, selector: string): Element[] {
  let current: Element | null | undefined = elem;
  const arr = [];
  while (current = current.parentElement?.closest(selector)) {
    arr.push(current);
  }
  return arr;
}
