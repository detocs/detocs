import { h, FunctionalComponent, RenderableProps, VNode, Fragment, createRef } from 'preact';

import TournamentSet from '@models/tournament-set';

import Autocomplete, { useAutocompleteId } from './autocomplete';

export interface Props {
  set?: TournamentSet;
  updateSet: (set: TournamentSet) => void;
  unfinishedSets?: TournamentSet[];
}

const serviceInfoFields: (keyof TournamentSet['serviceInfo'])[] = [
  'serviceName',
  'id',
  'phaseId',
  'phaseGroupId',
];

const SetSelector: FunctionalComponent<Props> = (props: RenderableProps<Props>): VNode => {
  const sets = props.unfinishedSets || [];
  const inputRef = createRef<HTMLInputElement>();
  const autocompleteId = useAutocompleteId();
  // TODO: Implement a way to clear this field
  return(
    <Fragment>
      {serviceInfoFields.map((field): VNode => {
        // NOTE: The switch statement here is to ensure that this won't compile
        // if it doesn't handle all serviceInfo fields
        // TODO: Can we rely on the assumption that serviceName + id is a unique
        // identifier?
        switch (field) {
          case 'serviceName':
          case 'id':
          case 'phaseId':
          case 'phaseGroupId':
            return (
              <input
                type="hidden"
                name={`set[${field}]`}
                value={props.set?.serviceInfo[field]}
              />
            );
        }
      })}
      <input
        ref={inputRef}
        list={autocompleteId}
        value={props.set?.displayName}
        class="set-selector"
        placeholder="Select Set"
      />
      <Autocomplete<TournamentSet>
        id={autocompleteId}
        inputRef={inputRef}
        options={sets}
        idMapper={s => `${s.serviceInfo.serviceName}_${s.serviceInfo.id}`}
        nameMapper={s => s.displayName}
        setValue={props.updateSet}
      />
    </Fragment>
  );
};
export default SetSelector;
