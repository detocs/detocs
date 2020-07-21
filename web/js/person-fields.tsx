import { h, createRef, Component, ComponentChild, Fragment } from 'preact';

import Person, { PersonUpdate, getName } from '@models/person';
import { checkResponseStatus } from '@util/ajax';
import { capitalize } from '@util/string';

import { infoEndpoint } from './api';
import Autocomplete from './autocomplete';
import { logError } from './log';

type PersonUpdater = (p: PersonUpdate, val: string) => PersonUpdate;
interface FieldMapping {
  getValue: (p: PersonUpdate) => string | null | undefined;
  updatedWithValue: PersonUpdater;
}
const fieldMappings: Record<string, FieldMapping> = {
  'handle': {
    getValue: p => p.handle,
    updatedWithValue: (p, val) => {
      return Object.assign({}, p, {
        handle: val,
        id: -1,
      });
    },
  },
  'prefix': {
    getValue: p => p.prefix,
    updatedWithValue: (p, val) => {
      return Object.assign({}, p, { prefix: val });
    },
  },
  'twitter': {
    getValue: p => p.twitter,
    updatedWithValue: (p, val) => {
      return Object.assign({}, p, { twitter: val });
    },
  },
};

export interface Props {
  prefix: string;
  personFields: string[];
  person: PersonUpdate;
  onUpdatePerson: (p: PersonUpdate) => void;
}

interface State {
  options: Person[];
}
export type PersonFieldsState = State;

export default class PersonFields extends Component<Props, State> {
  private autocompleteId = Autocomplete.newId();
  private handleRef = createRef<HTMLInputElement>();

  private constructor(props: Props) {
    super(props);
    this.state = {
      options: [],
    };
    if (!props.personFields.includes('handle')) {
      throw new Error('Handle field must be included');
    }
  }

  // Handles the race condition where someone else updates a person's
  // information between fetching the autocomplete options and selecting one
  public fetchAndUpdatePerson = (person: Person): void => {
    fetch(infoEndpoint(`/people/${person.id}`).href)
      .then(checkResponseStatus)
      .then(resp => resp.json())
      .then(this.updatePerson)
      .catch(logError);
  };

  public updatePerson = (person: PersonUpdate): void => {
    this.props.onUpdatePerson(person);
  };

  public updateAutocomplete = (options: Person[]): void => {
    this.setState({ options });
  };

  private handleHandleInput = (event: Event, updater: PersonUpdater): void => {
    const val = (event.target as HTMLInputElement).value;
    if (Autocomplete.isAutocompleteValue(val)) {
      return;
    }
    this.updatePerson(updater(this.props.person, val));
    this.props.person.id = undefined;
    if (val.length > 0) {
      const url = infoEndpoint('/people');
      url.search = `q=${encodeURIComponent(val)}`;
      fetch(url.href)
        .then(checkResponseStatus)
        .then(resp => resp.json())
        .then(this.updateAutocomplete)
        .catch(logError);
    }
  };

  private createFieldInput = (name: string): ComponentChild => {
    const mapping = fieldMappings[name];
    if (!mapping) {
      throw new Error(`Unknown Person field ${name}`);
    }
    let handler = (event: Event): void => {
      const val = (event.target as HTMLInputElement).value;
      this.updatePerson(mapping.updatedWithValue(this.props.person, val));
    };
    if (name === 'handle') {
      handler = (event: Event): void => {
        this.handleHandleInput(event, mapping.updatedWithValue);
      };
    }
    return <input
      type="text"
      name={`${this.props.prefix}[${name}]`}
      value={mapping.getValue(this.props.person) || ''}
      onInput={handler}
      placeholder={capitalize(name)}
      class={name}
      {...name === 'handle' ? {
        ref: this.handleRef,
        list: this.autocompleteId,
      } : {}}
    />;
  };

  public render(props: Props, state: State): ComponentChild {
    return (
      <Fragment>
        <input type="hidden" name={`${props.prefix}[id]`} value={props.person.id}/>
        {props.personFields.map(this.createFieldInput)}
        <Autocomplete<Person>
          id={this.autocompleteId}
          inputRef={this.handleRef}
          idMapper={p => `${p.id}`}
          nameMapper={getName}
          setValue={this.fetchAndUpdatePerson}
          options={state.options}
        />
      </Fragment>
    );
  }
}
