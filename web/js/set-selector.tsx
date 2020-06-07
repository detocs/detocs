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
        name="set"
        value={props.set?.id}
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
        idMapper={s => `${s.id}`}
        nameMapper={s => s.displayName}
        setValue={props.updateSet}
      />
    </Fragment>
  );
};
export default SetSelector;
