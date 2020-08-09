import { h, FunctionalComponent, RenderableProps, VNode, Fragment, createRef } from 'preact';

import TournamentSet from '@models/tournament-set';

import Autocomplete from './autocomplete';

export interface Props {
  set?: TournamentSet;
  updateSet: (set: TournamentSet) => void;
  unfinishedSets?: TournamentSet[];
}

const SetSelector: FunctionalComponent<Props> = (props: RenderableProps<Props>): VNode => {
  const sets = props.unfinishedSets || [];
  const inputRef = createRef<HTMLInputElement>();
  const autocompleteId = Autocomplete.useId();
  // TODO: Implement a way to clear this field
  return(
    <Fragment>
      <input
        type="hidden"
        name="set[serviceName]"
        value={props.set?.serviceInfo.serviceName}
      />
      <input
        type="hidden"
        name="set[id]"
        value={props.set?.serviceInfo.id}
      />
      <input
        type="hidden"
        name="set[phaseId]"
        value={props.set?.serviceInfo.phaseId}
      />
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
