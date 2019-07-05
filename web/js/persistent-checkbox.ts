export default class PersistentCheckbox extends HTMLInputElement {
  public constructor() {
    super();
  }

  private connectedCallback(): void {
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = this.name;
    hiddenInput.value = '';
    this.parentNode && this.parentNode.insertBefore(hiddenInput, this);
    this.addEventListener('input', () => {
      hiddenInput.disabled = this.checked;
    });
  }
}
