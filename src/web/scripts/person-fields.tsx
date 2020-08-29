import { h, Fragment, RenderableProps, VNode, FunctionalComponent } from 'preact';
import { forwardRef } from 'preact/compat';
import { useState, useRef, StateUpdater } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import Person, { PersonUpdate, getNameWithAlias } from '@models/person';
import { checkResponseStatus } from '@util/ajax';
import { capitalize } from '@util/string';

import { infoEndpoint } from './api';
import Autocomplete, { useAutocompleteId, isAutocompleteValue } from './autocomplete';
import { logError } from './log';

type PersonUpdater = (p: PersonUpdate, val: string) => PersonUpdate;
interface FieldMapping {
  getValue: (p: PersonUpdate) => string | null | undefined;
  updatedWithValue: PersonUpdater;
}
const fieldMappings: Record<string, FieldMapping> = {
  'handleOrAlias': {
    getValue: p => p.alias || p.handle,
    updatedWithValue: (p, val) => {
      return ({
        handle: val,
        prefix: null,
        id: '',
      });
    },
  },
  'handle': {
    getValue: p => p.handle,
    updatedWithValue: (p, val) => {
      return Object.assign({}, p, { handle: val });
    },
  },
  'alias': {
    getValue: p => p.alias,
    updatedWithValue: (p, val) => {
      return Object.assign({}, p, { alias: val });
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

export interface PersonFieldProps {
  prefix: string;
  person: PersonUpdate;
  onUpdatePerson: StateUpdater<PersonUpdate>;
}

export type PersonFieldInputProps = RenderableProps<PersonFieldProps & { fieldName: string }> &
JSXInternal.HTMLAttributes;

export const PersonFieldInput: FunctionalComponent<PersonFieldInputProps> = forwardRef(({
  fieldName,
  prefix,
  person,
  onUpdatePerson,
  ...additionalAttributes
}, ref): VNode => {
  const mapping = fieldMappings[fieldName];
  if (!mapping) {
    throw new Error(`Unknown Person field ${fieldName}`);
  }
  const handler = (event: Event): void => {
    const val = (event.target as HTMLInputElement).value;
    // TODO: Just pass updater?
    onUpdatePerson(mapping.updatedWithValue(person, val));
  };
  return <input
    type="text"
    name={`${prefix}[${fieldName}]`}
    value={mapping.getValue(person) || ''}
    onInput={handler}
    placeholder={capitalize(fieldName)}
    class={fieldName}
    ref={ref}
    {...additionalAttributes}
  />;
});

export const PersonSelector: FunctionalComponent<PersonFieldProps> = ({
  prefix,
  person,
  onUpdatePerson,
}): VNode => {
  const [ options, updateOptions ] = useState([]);
  const inputRef = useRef<HTMLInputElement>();
  const autocompleteId = useAutocompleteId();

  const handleHandleInput = (updater: PersonUpdater, event: Event): void => {
    const val = (event.target as HTMLInputElement).value;
    if (isAutocompleteValue(val)) {
      return;
    }
    onUpdatePerson(updater(person, val));
    if (val.length > 0) {
      const url = infoEndpoint('/people');
      url.search = `q=${encodeURIComponent(val)}`;
      fetch(url.href)
        .then(checkResponseStatus)
        .then(resp => resp.json())
        .then(updateOptions)
        .catch(logError);
    }
  };

  // Handles the race condition where someone else updates a person's
  // information between fetching the autocomplete options and selecting one
  const fetchAndUpdatePerson = (person: Person): void => {
    fetch(infoEndpoint(`/people/${person.id}`).href)
      .then(checkResponseStatus)
      .then(resp => resp.json())
      .then(onUpdatePerson)
      .catch(logError);
  };

  return (
    <Fragment>
      <input type="hidden" name={`${prefix}[id]`} value={person.id}/>
      <PersonFieldInput
        fieldName="handleOrAlias"
        prefix={prefix}
        person={person}
        onUpdatePerson={onUpdatePerson}
        ref={inputRef}
        list={autocompleteId}
        onInput={handleHandleInput.bind(null, fieldMappings['handleOrAlias'].updatedWithValue)}
        placeholder="Handle/Alias"
      />
      <Autocomplete<Person>
        id={autocompleteId}
        inputRef={inputRef}
        idMapper={p => `${p.id}`}
        nameMapper={getNameWithAlias}
        setValue={fetchAndUpdatePerson}
        options={options}
      />
    </Fragment>
  );
};
