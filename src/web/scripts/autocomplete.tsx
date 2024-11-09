import { h, RefObject, Component, ComponentChild } from 'preact';

import nextId from '@util/next-id';

import useId from './hooks/id';

const idRegex = /\{\{(\w+)\}\}/;

function getPlaceholder(id: string): string {
  return `{{${id}}}`;
}

export function newAutocompleteId(): string {
  return nextId('autocomplete-');
}

export function useAutocompleteId(): string {
  return useId(1, 'autocomplete-')[0];
}

export function isAutocompleteValue(val: string): boolean {
  return idRegex.test(val);
}

interface AutocompleteProps<T> {
  id: string;
  options: T[];
  inputRef: RefObject<HTMLInputElement>;
  idMapper: (entity: T) => string;
  nameMapper: (entity: T) => string;
  setValue: (entity: T) => void;
}

export default class Autocomplete<T> extends Component<AutocompleteProps<T>> {
  private findValueInOptions(id: string): T | null {
    return this.props.options
      .find(t => this.props.idMapper(t) === id) ||
      null;
  }

  private readonly handleInput = (event: Event): void => {
    const val = (event.target as HTMLInputElement).value;
    const match = idRegex.exec(val);
    if (match) {
      const id = match[1];
      const entity = this.findValueInOptions(id);
      entity && this.props.setValue(entity);
    }
  };

  public componentDidMount(): void {
    const input = this.props.inputRef.current;
    if (input) {
      input.addEventListener('input', this.handleInput);
    }
  }

  public componentWillUnmount(): void {
    const input = this.props.inputRef.current;
    if (input) {
      input.removeEventListener('input', this.handleInput);
    }
  }

  public render({
    id,
    options,
    idMapper,
    nameMapper,
  }: AutocompleteProps<T>): ComponentChild {
    return (
      <datalist id={id}>
        {options.map(
          t => <option value={getPlaceholder(idMapper(t))}>{nameMapper(t)}</option>
        )}
      </datalist>
    );
  }
}
