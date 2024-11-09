import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';
import { useCallback } from 'preact/hooks';

import { INTERACTIVE_SELECTOR } from '@util/dom';

import { register } from './key-manager';

type Shortcut = [string, string, (i: number, numTabs: number) => number];

const CONTROL_SELECTOR = ':scope > .js-tabbable-section > .js-tabbable-section-control';
const AUTOFOCUS_SELECTOR = '[autofocus]';

const UNIVERSAL_SHORTCUTS: Shortcut[] = [
  [ '!PageUp', 'Previous', i => i - 1 ],
  [ '^PageUp', 'Previous', i => i - 1 ],
  [ '!PageDown', 'Next', i => i + 1 ],
  [ '^PageDown', 'Next', i => i + 1 ],
  [ '^9', 'Last', (_, numTabs) => numTabs - 1 ],
];

const TAB_SHORTCUTS: Shortcut[] = [
  [ '^1', 'First', () => 0 ],
  [ '^2', 'Second', () => 1 ],
  [ '^3', 'Third', () => 2 ],
  [ '^4', 'Fourth', () => 3 ],
  [ '^5', 'Fifth', () => 4 ],
  [ '^6', 'Sixth', () => 5 ],
  [ '^7', 'Seventh', () => 6 ],
  [ '^8', 'Eigth', () => 7 ],
];

const TabController: FunctionalComponent = (
  { children }: RenderableProps<unknown>,
): VNode => {
  // TODO: Support changing number of children
  const numChildren = Array.isArray(children) ?
    children.length :
    children != null ? 1 : 0;
  const ref = useCallback((node: Element | null) => {
    selectFirstTab(node);
    window.addEventListener('hashchange', selectTabForHash.bind(null, node));
    registerKeyboardShortcuts(node, numChildren);
  }, []);

  return (
    <main class="tab-controller" role="tablist" ref={ref}>
      {children}
    </main>
  );
};
export default TabController;

function selectFirstTab(node: Element | null): void {
  if (!selectTabForHash(node)) {
    if (node) {
      move(node, 0);
    }
  }
}

function selectTabForHash(root: Element | null): boolean {
  if (!root) {
    return false;
  }
  const hash = window.location.hash;
  if (!hash) {
    return false;
  }
  const elem = document.getElementById(hash.substring(1));
  const index = getControls(root)
    .findIndex(tabControl => tabControl.closest('.js-tabbable-section')?.contains(elem));
  if (index < 0) {
    return false;
  }
  move(root, index);
  return true;
}

function registerKeyboardShortcuts(node: Element | null, numTabs: number): VoidFunction[] {
  if (!node) {
    return [];
  }
  const shortcuts = UNIVERSAL_SHORTCUTS.concat(TAB_SHORTCUTS.slice(0, numTabs));
  return shortcuts.map(s => shortcut(node, numTabs, s));
}

function shortcut(
  node: Element,
  numTabs: number,
  shortcut: Shortcut,
): () => void {
  const [ keystroke, name, idxFunc] = shortcut;
  return register(
    keystroke,
    `Tabs: ${name}`,
    () => {
      const newIndex = idxFunc(getIndex(node), numTabs);
      move(node, newIndex);
    },
  );
}

function getIndex(root: Element): number {
  return getControls(root).findIndex(i => i.checked);
}

function move(root: Element, index: number): void {
  const tabs = getControls(root);
  const len = tabs.length;
  const targetIndex = (index + len) % len;
  tabs.forEach((tab, i) => {
    if (i === targetIndex) {
      tab.checked = true;
      tab.setAttribute('aria-selected', 'true');
      const section = tab.closest('.js-tabbable-section') as HTMLElement;
      section.scrollIntoView({ behavior: 'smooth' });
      const content = section.querySelector('.js-tabbable-section-content') as HTMLElement;
      const input = content.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR) ||
        content.querySelector<HTMLElement>(INTERACTIVE_SELECTOR);
      if (input) {
        input.focus();
      }
    } else {
      tab.setAttribute('aria-selected', 'false');
    }
  });
}

function getControls(root: Element): HTMLInputElement[] {
  return Array.from(root.querySelectorAll(CONTROL_SELECTOR) as NodeListOf<HTMLInputElement>);
}
