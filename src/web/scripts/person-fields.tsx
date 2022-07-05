import updateImmutable from 'immutability-helper';
import debounce from 'lodash.debounce';
import { h, Fragment, RenderableProps, VNode, FunctionalComponent } from 'preact';
import { forwardRef } from 'preact/compat';
import { useState, useRef, StateUpdater, useCallback, useEffect } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import Person, { PersonUpdate, getPrefixedNameWithAlias, getNameWithAlias } from '@models/person';
import { checkResponseStatus } from '@util/ajax';
import { capitalize } from '@util/string';

import { infoEndpoint } from './api';
import Autocomplete, { useAutocompleteId, isAutocompleteValue } from './autocomplete';
import Icon from './icon';
import { logError } from './log';
import TextInput from './text-input';

type PersonUpdater = (p: PersonUpdate, val: string) => PersonUpdate;
interface FieldMapping {
  formName: string | null;
  label?: string;
  pattern?: { regex: string; description: string; };
  getValue: (p: PersonUpdate) => string | null | undefined;
  updatedWithValue: PersonUpdater;
}
const fieldMappings: Record<string, FieldMapping> = {
  'handleOrAlias': {
    formName: null,
    getValue: p => getNameWithAlias(p),
    updatedWithValue: (p, val) => {
      return ({
        handle: val,
        prefix: null,
        id: '',
      });
    },
  },
  'handle': {
    formName: '[handle]',
    label: 'Handle',
    getValue: p => p.handle,
    updatedWithValue: (p, val) => updateImmutable(p, {
      handle: {
        $set: val,
      },
    }),
  },
  'alias': {
    formName: '[alias]',
    label: 'Alias',
    getValue: p => p.alias,
    updatedWithValue: (p, val) => updateImmutable(p, {
      alias: {
        $set: val,
      },
    }),
  },
  'prefix': {
    formName: '[prefix]',
    label: 'Prefix',
    getValue: p => p.prefix,
    updatedWithValue: (p, val) => updateImmutable(p, {
      prefix: {
        $set: val,
      },
    }),
  },
  'twitter': {
    formName: '[serviceIds][twitter]',
    label: 'Twitter',
    pattern: { regex: '[a-zA-Z0-9_]*', description: 'Letters, numbers, or underscores' },
    getValue: p => p.serviceIds?.twitter,
    updatedWithValue: (p, val) => updateImmutable(p, {
      serviceIds: serviceIds => updateImmutable(serviceIds || {}, {
        'twitter': {
          $set: val,
        },
      }),
    }),
  },
};

export interface PersonFieldProps {
  prefix: string;
  person: PersonUpdate;
  onUpdatePerson: StateUpdater<PersonUpdate>;
}

export type PersonFieldInputProps = RenderableProps<PersonFieldProps & {
  fieldName: string;
  label?: string;
}> &
JSXInternal.HTMLAttributes;

export const PersonFieldInput = forwardRef<HTMLInputElement, PersonFieldInputProps>(({
  fieldName,
  label,
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
  return <TextInput
    name={mapping.formName ? `${prefix}${mapping.formName}` : undefined}
    value={mapping.getValue(person) || ''}
    onInput={handler}
    label={label ?? mapping.label ?? capitalize(fieldName)}
    {...mapping.pattern && {
      pattern: mapping.pattern.regex,
      title: mapping.pattern.description,
    }}
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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteId = useAutocompleteId();

  const updateAutocomplete = useCallback(
    debounce(
      (val: string): Promise<void> => {
        const url = infoEndpoint('/people');
        url.search = `q=${encodeURIComponent(val)}`;
        return fetch(url.href)
          .then(checkResponseStatus)
          .then(resp => resp.json())
          .then(updateOptions)
          .catch(logError);
      },
      300,
    ),
    [],
  );

  useEffect(() => {
    updateAutocomplete(person.handle || '');
  }, [ person.handle ]);

  const handleHandleInput = (updater: PersonUpdater, event: Event): void => {
    const val = (event.target as HTMLInputElement).value;
    if (isAutocompleteValue(val)) {
      return;
    }
    onUpdatePerson(updater(person, val));
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

  const label = person.alias ?
    getNameWithAlias({
      handle: 'Handle',
      alias: 'Alias',
    }) :
    'Handle';

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
        label={label}
        autoFocus={true}
      />
      <Autocomplete<Person>
        id={autocompleteId}
        inputRef={inputRef}
        idMapper={p => `${p.id}`}
        nameMapper={getPrefixedNameWithAlias}
        setValue={fetchAndUpdatePerson}
        options={options}
      />
    </Fragment>
  );
};

export function PersonAdditionalFields({ children }: RenderableProps<unknown>): VNode {
  return (
    <details class="person__additional-fields">
      <summary>
        <span class="details--closed"><Icon name="more" label="More Fields" /></span>
        <span class="details--open">
          Additional Fields
          <Icon name="close" label="Hide Additional Fields" />
        </span>
      </summary>
      <div class="input-row">
        {children}
      </div>
    </details>
  );
}
