import { h, VNode, FunctionalComponent } from "preact";
import { Fragment } from "../../util/preact";

interface Props {
  name: string;
  checked: boolean;
  onChange: () => void;
}

export const PersistentCheckbox: FunctionalComponent<Props> = (props): VNode => {
  const checkbox = <input
    type="checkbox"
    name={props.name}
    checked={props.checked}
    onChange={props.onChange}
  />;
  return (
    <Fragment>
      {checkbox}
      {!props.checked && <input type="hidden" name={props.name} value="" />}
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
    console.log('update checkbox');
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
