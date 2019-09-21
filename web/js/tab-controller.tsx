import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';
import { useCallback } from 'preact/hooks';

import { register } from './key-manager';

const CONTROL_SELECTOR = ':scope > .tabbable-section > .tabbable-section-control';
const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), button, a, select, textarea, [tabindex]:not([tabindex="-2"])';

const TabController: FunctionalComponent = ({ children }: RenderableProps<{}>): VNode => {
  const ref = useCallback((node: Element) => { 
    // TODO: Select tab based on url hash
    move(node, 0);
  }, []);
  return (
    <main class="tab-controller" ref={ref}>
      {children}
    </main>
  );
};
export default TabController;

// TODO: Get keyboard shortcuts working again
class OldController extends HTMLElement {
  private unregister: (() => void)[] = [];

  private connectedCallback(): void {
    this.unregister = [
      this.shortcut('PageUp', 'Previous', i => i - 1),
      this.shortcut('PageDown', 'Next', i => i + 1),
      this.shortcut('^1', 'First', () => 0),
      this.shortcut('^2', 'Second', () => 1),
      this.shortcut('^3', 'Third', () => 2),
      this.shortcut('^4', 'Fourth', () => 3),
      // TODO: Vary shortcuts with number of tabs
    ];
  }

  private disconnectedCallback(): void {
    this.unregister.forEach(f => f());
  }

  private shortcut(
    keystroke: string,
    name: string,
    idxFunc: (index: number) => number
  ): () => void {
    return register(
      keystroke,
      `Tabs: ${name}`,
      () => {
        const newIndex = idxFunc(this.getIndex());
        this.move(newIndex);
      },
    );
  }

  private getIndex(): number {
    return getIndex(this);
  }

  private move(index: number): void {
    move(this, index);
  }
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
