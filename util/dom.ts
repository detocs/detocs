import { JSX } from 'preact';
import { Key } from 'w3c-keys';

type KeyEventHandler = (event: KeyboardEvent) => unknown;
type KeyHandlerRecord = Partial<Record<Key, EventHandlerNonNull>>;

export const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), button, a, select, textarea, [tabindex]:not([tabindex="-2"])';

export function cloneTemplate(id: string): DocumentFragment {
  const template = document.getElementById(id) as HTMLTemplateElement;
  return template.content.cloneNode(true) as DocumentFragment;
}

export function inputHandler(fn: (value: string) => void): JSX.EventHandler<Event> {
  return (e: Event) => fn((e.target as HTMLInputElement).value);
}

export function keyHandler(
  handlers: Map<Key | Key[], EventHandlerNonNull> | KeyHandlerRecord,
): KeyEventHandler {
  const entries: [string | string[], EventHandlerNonNull][] = handlers instanceof Map ?
    Array.from(handlers.entries()) :
    Object.entries(handlers) as [string, EventHandlerNonNull][];
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
