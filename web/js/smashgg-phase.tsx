import { h, FunctionalComponent, VNode } from 'preact';

import TournamentSet from '../../models/tournament-set';

import SetSelector from './set-selector';

interface Props {
  phaseId?: string;
  set?: TournamentSet;
  unfinishedSets?: TournamentSet[];
}

const SmashggPhase: FunctionalComponent<Props> = ({
  phaseId,
  set,
  unfinishedSets,
}): VNode => {
  return (
    <fieldset name="smashgg">
      <legend>Smash.gg</legend>
      <div class="input-row">
        <input
          type="text"
          name="phaseId"
          value={phaseId}
          placeholder="Phase"
          size={7}
          class="smashgg__phase-id"
        />
        <SetSelector {...{ set, unfinishedSets, updateSet: () => {} }}/>
      </div>
    </fieldset>
  );
};
export default SmashggPhase;
