import { h, FunctionalComponent, VNode } from 'preact';
import { useRef } from 'preact/hooks';

import TournamentSet from '@models/tournament-set';
import { checkResponseStatus } from '@util/ajax';
import { fieldSetFormData } from '@util/forms';

import { infoEndpoint } from './api';
import { useLocalState } from './hooks/local-state';
import SetSelector from './set-selector';

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
  const [ localSet, updateSet ] = useLocalState(set);
  const ref = useRef<HTMLFieldSetElement>();
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
          set={localSet}
          unfinishedSets={unfinishedSets}
          updateSet={updateSet}
        />
        <button type="button" onClick={submit}>Fill</button>
      </div>
    </fieldset>
  );
};
export default BracketSet;
