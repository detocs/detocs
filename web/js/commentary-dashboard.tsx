import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { nullPerson, PersonUpdate } from '../../models/person';
import InfoState from '../../server/info/state';
import { INTERACTIVE_SELECTOR } from '../../util/dom';

import { useCommentator1, useCommentator2 } from './hooks/info';

import { infoEndpoint } from './api';
import PersonFields from './person-fields';

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
        <fieldset name="commentator" class="commentator js-commentator">
          <legend>Commentator 1</legend>
          <div className="input-row">
            <PersonFields
              person={com1}
              prefix="players[]"
              personFields={[ "handle", "prefix", "twitter" ]}
              onUpdatePerson={updateCom1}
            />
            <button type="button" onClick={resetCommentator.bind(null, updateCom1)}>
              Reset 1
            </button>
          </div>
        </fieldset>
        <fieldset name="commentator" class="commentator js-commentator">
          <legend>Commentator 2</legend>
          <div className="input-row">
            <PersonFields
              person={com2}
              prefix="players[]"
              personFields={["handle", "prefix", "twitter"]}
              onUpdatePerson={updateCom2}
            />
            <button type="button" onClick={resetCommentator.bind(null, updateCom2)}>
              Reset 2
            </button>
          </div>
        </fieldset>
      </div>
      <div class="input-row">
        <fieldset name="tournament">
          <legend>Tournament</legend>
          <div class="input-row">
            <input
              type="text"
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
              type="text"
              name="event"
              placeholder="Event"
              value={state.event}
            />
          </div>
        </fieldset>
      </div>
      <div class="input-row">
        <button type="button" onClick={resetCommentators.bind(null, state, updateState)}>
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

function resetCommentator(updater: StateUpdater<PersonUpdate>, event: UIEvent): void {
  updater(nullPerson);
  const button = event.target as HTMLButtonElement;
  button?.closest('.input-row')
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
