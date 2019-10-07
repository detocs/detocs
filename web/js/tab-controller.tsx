import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';
import { useCallback } from 'preact/hooks';

import { register } from './key-manager';

const CONTROL_SELECTOR = ':scope > .tabbable-section > .tabbable-section-control';
const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), button, a, select, textarea, [tabindex]:not([tabindex="-2"])';
const TabController: FunctionalComponent = ({ children }: RenderableProps<{}>): VNode => {
  const ref = useCallback((node: Element | null) => {
    selectFirstTab(node);
    registerKeyboardShortcuts(node);
  }, []);

  return (
    <main class="tab-controller" ref={ref}>
      {children}
    </main>
  );
};
export default TabController;

function selectFirstTab(node: Element | null): void {
  // TODO: Select tab based on url hash
  if (node) {
    move(node, 0);
  }
};

function registerKeyboardShortcuts(node: Element | null): VoidFunction[] {
  if (!node) {
    return [];
  }
  return [
    shortcut(node, 'PageUp', 'Previous', i => i - 1),
    shortcut(node, 'PageDown', 'Next', i => i + 1),
    shortcut(node, '^1', 'First', () => 0),
    shortcut(node, '^2', 'Second', () => 1),
    shortcut(node, '^3', 'Third', () => 2),
    shortcut(node, '^4', 'Fourth', () => 3),
    shortcut(node, '^5', 'Fifth', () => 4),
    // TODO: Vary shortcuts with number of tabs
  ];
}

function shortcut(
  node: Element,
  keystroke: string,
  name: string,
  idxFunc: (index: number) => number
): () => void {
  return register(
    keystroke,
    `Tabs: ${name}`,
    () => {
      const newIndex = idxFunc(getIndex(node));
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
  const targetTab = tabs[(index + len) % len];
  targetTab.checked = true;
  const section = targetTab.closest('.tabbable-section') as HTMLElement;
  const content = section.querySelector('.tabbable-section-content') as HTMLElement;
  const input = content.querySelector(INTERACTIVE_SELECTOR) as HTMLElement | null;
  if (!input) {
    return;
  }
  input.focus();
}

function getControls(root: Element): HTMLInputElement[] {
  return Array.from(root.querySelectorAll(CONTROL_SELECTOR) as NodeListOf<HTMLInputElement>);
}
