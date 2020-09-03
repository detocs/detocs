import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { nullPerson, PersonUpdate } from '@models/person';
import InfoState from '@server/info/state';
import { INTERACTIVE_SELECTOR } from '@util/dom';

import { infoEndpoint } from './api';
import { useCommentator1, useCommentator2 } from './hooks/info';
import Icon from './icon';
import { PersonFieldInput, PersonSelector, PersonFieldProps } from './person-fields';

interface Props {
  state: InfoState;
  updateState: StateUpdater<InfoState>;
}

const CommentaryDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const [ com1, updateCom1 ] = useCommentator1(state, updateState);
  const [ com2, updateCom2 ] = useCommentator2(state, updateState);
  return(
    <form
      action={infoEndpoint('/lowerthird').href}
      method="post"
      class="commentary"
      autocomplete="off"
    >
      <div class="players">
        <Commentator
          index={0}
          prefix="players[]"
          person={com1}
          onUpdatePerson={updateCom1}
        />
        <Commentator
          index={1}
          prefix="players[]"
          person={com2}
          onUpdatePerson={updateCom2}
        />
      </div>
      <div class="input-row">
        <fieldset name="tournament">
          <legend>Tournament</legend>
          <div class="input-row">
            <input
              name="tournament"
              placeholder="Tournament"
              value={state.tournament}
            />
          </div>
        </fieldset>
        <fieldset name="event">
          <legend>Event</legend>
          <div class="input-row">
            <input
              name="event"
              placeholder="Event"
              value={state.event}
            />
          </div>
        </fieldset>
      </div>
      <div class="action-row">
        <button type="button"
          class="warning"
          onClick={resetCommentators.bind(null, state, updateState)}
        >
          Reset
        </button>
        <button type="button" onClick={swapCommentators.bind(null, state, updateState)}>
          Swap
        </button>
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default CommentaryDashboard;


type CommentatorProps = PersonFieldProps & {
  index: number;
};

function Commentator({ index, prefix, person, onUpdatePerson }: CommentatorProps): VNode {
  return (
    <fieldset name="commentator" class="commentator js-commentator">
      <legend>
        Commentator {index+1}
        {' '}
        <button type="button" class="warning" onClick={resetCommentator.bind(null, onUpdatePerson)}>
          Reset
        </button>
      </legend>
      <div className="input-row">
        <PersonSelector
          prefix={prefix}
          person={person}
          onUpdatePerson={onUpdatePerson}
        />
        <PersonFieldInput
          fieldName="prefix"
          prefix={prefix}
          person={person}
          onUpdatePerson={onUpdatePerson}
        />
        <PersonFieldInput
          fieldName="twitter"
          prefix={prefix}
          person={person}
          onUpdatePerson={onUpdatePerson}
        />
        <details>
          <summary>
            <span class="details--closed"><Icon name="more" label="More" /></span>
            <span class="details--open"> Additional Fields</span>
          </summary>
          <div class="input-row">
            {[ 'handle', 'alias' ].map(fieldName =>
              <PersonFieldInput
                fieldName={fieldName}
                prefix={prefix}
                person={person}
                onUpdatePerson={onUpdatePerson}
              />
            )}
          </div>
        </details>
      </div>
    </fieldset>
  );
}

function resetCommentator(updater: StateUpdater<PersonUpdate>, event: UIEvent): void {
  updater(nullPerson);
  const button = event.target as HTMLButtonElement;
  button?.closest('fieldset')
    ?.querySelector<HTMLInputElement>(INTERACTIVE_SELECTOR)
    ?.focus();
}

function resetCommentators(state: InfoState, updateState: StateUpdater<InfoState>): void {
  const newState = Object.assign({}, state);
  newState.commentators = newState.commentators.map(() => ({
    person: nullPerson,
  }));
  updateState(newState);
}

function swapCommentators(state: InfoState, updateState: StateUpdater<InfoState>): void {
  const newState = Object.assign({}, state);
  newState.commentators = newState.commentators.slice().reverse();
  updateState(newState);
}
