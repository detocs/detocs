// TODO: Add modal for checking shortcuts
// TODO: Import a keyboard library?

export type KeyHandler = (event: KeyboardEvent) => void;

interface Keystroke {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

interface Shortcut extends Keystroke {
  name: string;
  handler: KeyHandler;
}

let shortcutList: Shortcut[] = [];

export function register(keystroke: string, name: string, handler: KeyHandler): () => void {
  const ks = parseKeystroke(keystroke);
  const shortcut = {
    ...ks,
    name,
    handler,
  };
  shortcutList.push(shortcut);

  const h: KeyHandler = (e): void => {
    if (e.key === shortcut.key &&
      e.ctrlKey === shortcut.ctrl &&
      e.shiftKey === shortcut.shift &&
      e.altKey === shortcut.alt &&
      e.metaKey === shortcut.meta)
    {
      e.preventDefault();
      shortcut.handler(e);
    }
  };
  document.addEventListener('keydown', h);

  return () => {
    document.removeEventListener('keydown', h);
    shortcutList = shortcutList.filter(s => s !== shortcut);
  };
}

function parseKeystroke(keystroke: string): Keystroke {
  const match = keystroke.match(/^([#~!^]*)(.+)$/);
  if (!match) {
    throw new Error('Invalid keystroke');
  }
  const key = match[2];
  const modifiers = match[1];
  return {
    key,
    ctrl: modifiers.includes('^'),
    shift: modifiers.includes('!'),
    alt: modifiers.includes('~'),
    meta: modifiers.includes('#'),
  };
}