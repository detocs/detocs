export default class PersistentCheckbox extends HTMLInputElement {
  private readonly hiddenInput = document.createElement('input');

  private connectedCallback(): void {
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.hiddenInput.value = '';
    this.parentNode && this.parentNode.insertBefore(this.hiddenInput, this.nextSibling);
    this.addEventListener('input', this.update);
  }

  private update = (): void => {
    this.hiddenInput.disabled = this.checked;
  };

  public get checked(): boolean {
    return super.checked;
  }

  public set checked(checked: boolean) {
    super.checked = checked;
    this.update();
  }
}
