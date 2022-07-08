import updateImmutable from 'immutability-helper';
import { h, FunctionalComponent, RenderableProps, VNode, Fragment } from 'preact';
import { useRef } from 'preact/hooks';

import TournamentSet, { nullSet, getTournamentSetIdString } from '@models/tournament-set';
import { inputHandler } from '@util/dom';

import Autocomplete, { useAutocompleteId, isAutocompleteValue } from './autocomplete';

export interface Props {
  set?: TournamentSet;
  updateSet: (set: TournamentSet) => void;
  unfinishedSets: TournamentSet[];
}

const serviceInfoFields: (keyof TournamentSet['serviceInfo'])[] = [
  'serviceName',
  'id',
  'phaseId',
  'phaseGroupId',
];

const SetSelector: FunctionalComponent<Props> = ({
  set,
  updateSet,
  unfinishedSets,
}: RenderableProps<Props>): VNode => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteId = useAutocompleteId();
  // TODO: Implement a way to clear this field

  return(
    <Fragment>
      {serviceInfoFields.map((field): VNode => {
        // NOTE: The switch statement here is to ensure that this won't compile
        // if it doesn't handle all serviceInfo fields
        switch (field) {
          case 'serviceName':
          case 'id':
          case 'phaseId':
          case 'phaseGroupId':
            return (
              <input
                type="hidden"
                name={`set[${field}]`}
                value={set?.serviceInfo[field]}
              />
            );
        }
      })}
      <input
        ref={inputRef}
        list={autocompleteId}
        value={set?.displayName}
        onInput={inputHandler(val => {
          if (isAutocompleteValue(val)) {
            return;
          }
          updateSet(updateImmutable(nullSet, {
            $merge: {
              displayName: val,
            },
          }));
        })}
        class="set-selector"
        placeholder="Select Set"
      />
      <Autocomplete<TournamentSet>
        id={autocompleteId}
        inputRef={inputRef}
        options={unfinishedSets}
        idMapper={getTournamentSetIdString}
        nameMapper={s => s.displayName}
        setValue={updateSet}
      />
    </Fragment>
  );
};
export default SetSelector;
