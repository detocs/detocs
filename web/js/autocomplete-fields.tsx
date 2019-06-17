import { h, Component, ComponentChild } from 'preact';

import { infoEndpoint } from './api';

interface Autocompletable {
  id: string;
  name: string;
}

const idRegex = /\{(\w+)\}/;
let idCounter = 0;

class AutocompleteFields<T extends Autocompletable>
  extends Component<{}, { value: T; options: T[] }>
{
  private readonly autocompleteId: string;
  private readonly nullValue: T;
  private readonly id: string;
  private readonly displayName: string;

  public constructor(id: string, displayName: string, nullValue: T) {
    super();
    this.nullValue = Object.freeze(Object.assign({}, nullValue));
    this.id = id;
    this.displayName = displayName;
    this.state = {
      value: this.nullValue,
      options: [],
    };
    this.autocompleteId = `autocomplete-${idCounter++}`;

    const ws = new WebSocket(infoEndpoint('', 'ws:').href);
    ws.onmessage = this.receiveServerUpdate.bind(this);
    ws.onerror = console.error;
  }

  private receiveServerUpdate(ev: MessageEvent): void {
    const newValue = JSON.parse(ev.data) as T;
    this.setValue(newValue);
  }

  private findValueInOptions(id: string): T {
    return this.state.options
      .find(t => t.id === id) ||
      this.nullValue;
  }

  protected setValue(value: T): void {
    this.setState({ value });
  }

  protected setOptions(options: T[]): void {
    this.setState({ options });
  }

  private handleInput = (event: Event): void => {
    const name = (event.target as HTMLInputElement).value;
    const match = idRegex.exec(name);
    if (match) {
      const id = match[1];
      this.setValue(this.findValueInOptions(id));
      return;
    }
    this.setValue(Object.assign({}, this.nullValue, { name }));
  };

  public render(_: unknown, state: { value: T; options: T[] }): ComponentChild {
    return (
      <fieldset name={this.id}>
        <legend>{this.displayName}</legend>
        <div class="input-row">
          <input
            type="hidden"
            name={`${this.id}[id]`}
            value={state.value.id}
          />
          <input
            type="text"
            name={`${this.id}[name]`}
            value={state.value.name}
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
