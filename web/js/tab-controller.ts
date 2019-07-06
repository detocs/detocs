import { register } from "./key-manager";

const CONTROL_SELECTOR = ':scope > .tabbable-section > .tabbable-section-control';
const INTERACTIVE_SELECTOR =
  'input:not([type="hidden"]), button, a, select, textarea, [tabindex]:not([tabindex="-2"])';

export default class TabController extends HTMLElement {
  private unregister: (() => void)[] = [];

  private connectedCallback(): void {
    this.unregister = [
      this.shortcut('PageUp', 'Previous', i => i - 1),
      this.shortcut('PageDown', 'Next', i => i + 1),
      this.shortcut('^1', 'First', () => 0),
      this.shortcut('^2', 'Second', () => 1),
      this.shortcut('^3', 'Third', () => 2),
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
    return this.getControls().findIndex(i => i.checked);
  }

  private move(index: number): void {
    const tabs = this.getControls();
    const len = tabs.length;
    const targetTab = tabs[(index + len) % len];
    targetTab.checked = true;
    const section = targetTab.closest('.tabbable-section') as HTMLElement;
    console.log(section);
    const content = section.querySelector('.tabbable-section-content') as HTMLElement;
    console.log(content);
    const input = content.querySelector(INTERACTIVE_SELECTOR) as HTMLElement | null;
    console.log(input);
    if (!input) {
      return;
    }
    input.focus();
  }

  private getControls(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll(CONTROL_SELECTOR) as NodeListOf<HTMLInputElement>);
  }
}
