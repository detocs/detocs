import { h, Component, ComponentChild } from 'preact';

interface Autocompletable {
  id: string;
  name: string;
}

const idRegex = /\{(\w+)\}/;
let idCounter = 0;

interface Props<T> {
  value: T;
  updateValue: (value: T) => void;
}

interface State<T> {
  options: T[];
}

// TODO: Replace usages with Autocomplete
class AutocompleteFields<T extends Autocompletable>
  extends Component<Props<T>, State<T>>
{
  private readonly autocompleteId: string;
  private readonly nullValue: T;
  private readonly id: string;
  private readonly displayName: string;

  public constructor(id: string, displayName: string, nullValue: T) {
    super();
    this.nullValue = nullValue;
    this.id = id;
    this.displayName = displayName;
    this.state = {
      options: [],
    };
    this.autocompleteId = `autocomplete-fields-${idCounter++}`;
  }

  private findValueInOptions(id: string): T {
    return this.state.options
      .find(t => t.id === id) ||
      this.nullValue;
  }

  protected setOptions(options: T[]): void {
    this.setState({ options });
  }

  private handleInput = (event: Event): void => {
    const name = (event.target as HTMLInputElement).value;
    const match = idRegex.exec(name);
    if (match) {
      const id = match[1];
      this.props.updateValue(this.findValueInOptions(id));
      return;
    }
    this.props.updateValue(Object.assign({}, this.nullValue, { name }));
  };

  public render(props: Props<T>, state: State<T>): ComponentChild {
    return (
      <fieldset name={this.id}>
        <legend>{this.displayName}</legend>
        <div class="input-row">
          <input
            type="hidden"
            name={`${this.id}[id]`}
            value={props.value.id}
          />
          <input
            name={`${this.id}[name]`}
            value={props.value.name}
            onInput={this.handleInput}
            list={this.autocompleteId}
            placeholder={this.displayName}
          />
          <datalist id={this.autocompleteId}>
            {state.options.map(t => <option value={`{${t.id}}`}>{t.name}</option>)}
          </datalist>
        </div>
      </fieldset>
    );
  }
}

export default AutocompleteFields;
