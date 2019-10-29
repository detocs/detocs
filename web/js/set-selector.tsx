import { h, FunctionalComponent, RenderableProps, VNode } from 'preact';
import TournamentSet from '../../models/tournament-set';

export interface Props {
  set?: TournamentSet;
  updateSet: (set: TournamentSet) => void;
  unfinishedSets?: TournamentSet[];
}

const SetSelector: FunctionalComponent<Props> = (props: RenderableProps<Props>): VNode => {
  const sets = props.unfinishedSets || [];
  return(
    <select
      name="set"
      class="set-selector"
      value={props.set && props.set.id}
      onChange={(e: Event) => {
        const select = e.target as HTMLSelectElement;
        return props.updateSet(
          sets.find(s => s.id === select.value) || sets[0]
        );
      }}
    >
      <option>Select Set</option>
      {sets.map(s =>
        <option value={s.id}>{s.displayName}</option>
      )}
    </select>
  );
};
export default SetSelector;
