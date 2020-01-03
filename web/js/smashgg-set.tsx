import { h, FunctionalComponent, VNode } from 'preact';
import { useState, useEffect } from 'preact/hooks';

import TournamentSet from '../../models/tournament-set';

import SetSelector from './set-selector';

// TODO: Take in set updater
interface Props {
  set?: TournamentSet;
  unfinishedSets?: TournamentSet[];
}

const SmashggSet: FunctionalComponent<Props> = ({
  set,
  unfinishedSets,
}): VNode => {
  // Prevent updates of unfinishedSets from clearing unsaved changes
  const [ localSet, updateSet ] = useState(set);
  useEffect(() => {
    updateSet(set);
  }, [ set ]);
  return (
    <fieldset name="smashgg">
      <legend>Smash.gg Set</legend>
      <div class="input-row">
        <SetSelector
          set={localSet}
          unfinishedSets={unfinishedSets}
          updateSet={updateSet}
        />
      </div>
    </fieldset>
  );
};
export default SmashggSet;
