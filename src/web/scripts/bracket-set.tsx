import isEqual from 'lodash.isequal';
import { h, FunctionalComponent, VNode } from 'preact';
import { useRef } from 'preact/hooks';

import TournamentSet, { getTournamentSetIdString } from '@models/tournament-set.ts';
import { checkResponseStatus } from '@util/ajax.ts';
import { fieldSetFormData } from '@util/forms.ts';

import { infoEndpoint } from './api.ts';
import { useLocalState } from './hooks/local-state.ts';
import SetSelector from './set-selector.tsx';

// TODO: Take in set updater
interface Props {
  set?: TournamentSet;
  unfinishedSets?: TournamentSet[];
}

const BracketSet: FunctionalComponent<Props> = ({
  set,
  unfinishedSets,
}): VNode => {
  // Prevent updates of unfinishedSets from clearing unsaved changes
  const [ localSet, updateSet ] = useLocalState(set, {
    keyGenerator: set => set ? getTournamentSetIdString(set) : set,
  });
  const sets = unfinishedSets || [];
  const currentSet = localSet?.serviceInfo.id
    ? sets.find(s => isEqual(s.serviceInfo, localSet.serviceInfo)) || localSet
    : localSet;
  const ref = useRef<HTMLFieldSetElement>(null);
  const submit = (): void => {
    const form = ref.current?.form;
    if (!ref.current || !form) {
      return;
    }
    const body = fieldSetFormData(ref.current);
    fetch(
      infoEndpoint('/scoreboardBracketFill').href,
      {
        method: 'POST',
        body,
      },
    ).then(checkResponseStatus);
  };
  return (
    <fieldset name="bracketSet" ref={ref}>
      <legend>Bracket Set</legend>
      <div class="input-row">
        <SetSelector
          set={currentSet}
          unfinishedSets={sets}
          updateSet={updateSet}
        />
        <button type="button" onClick={submit}>Fill</button>
      </div>
    </fieldset>
  );
};
export default BracketSet;
