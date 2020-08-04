import { h, VNode, FunctionalComponent, Fragment } from 'preact';
import { JSXInternal } from 'preact/src/jsx';

interface Props extends JSXInternal.HTMLAttributes {
  name: string;
  checked: boolean;
  onChange: () => void;
}

export const PersistentCheckbox: FunctionalComponent<Props> = ({
  name,
  checked,
  onChange,
  ...additionalProps
}): VNode => {
  return (
    <Fragment>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        {...additionalProps}
      />
      {!checked && <input type="hidden" name={name} value="" />}
    </Fragment>
  );
};

export class PersistentCheckboxElement extends HTMLInputElement {
  private readonly hiddenInput = document.createElement('input');

  private connectedCallback(): void {
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.hiddenInput.value = '';
    this.parentNode && this.parentNode.insertBefore(this.hiddenInput, this.nextSibling);
    this.addEventListener('input', this.update);
    this.update();
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
