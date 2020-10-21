import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { StateUpdater, useRef, useEffect } from 'preact/hooks';

import BracketState, { nullState } from '@server/bracket/state';
import { keyHandler, Key } from '@util/dom';
import { submitForm } from '@util/forms';

import { bracketEndpoint } from './api';

interface Props {
  state: BracketState;
  updateState: StateUpdater<BracketState>;
}

const submitOnEnter = keyHandler({
  [Key.Enter]: submitForm,
});

const BracketDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const clearTournament = (): void => updateState(nullState);
  const tournament = state.tournament;
  const event = state.eventId ? state.events.find(e => e.id === state.eventId) : null;
  const phase = state.phaseId ? state.phases.find(p => p.id === state.phaseId) : null;
  const phaseGroups = state.phaseId ?
    state.phaseGroups.filter(pg => pg.phaseId === state.phaseId) :
    [];
  const tournamentRef = useRef<HTMLInputElement>();
  const eventRef = useRef<HTMLSelectElement>();
  const phaseRef = useRef<HTMLSelectElement>();
  useEffect(() => {
    if (!state.tournamentId) {
      tournamentRef.current?.focus();
    } else {
      eventRef.current?.focus();
    }
  }, [ state.tournamentId ]);
  useEffect(() => {
    if (state.eventId) {
      phaseRef.current?.focus();
    }
  }, [ state.eventId ]);

  return(
    <form
      action={bracketEndpoint('/update').href}
      method="post"
      autocomplete="off"
      class="bracket__container"
    >
      {state.tournamentId ?
        <div>
          <input type="hidden" name="tournamentId" value={state.tournamentId}/>
          Tournament: {tournament ?
            <a href={tournament.url}>{tournament.name}</a> :
            <code>{state.tournamentId} </code>}
          {' '}
          <button type="button" onClick={clearTournament}>Clear</button>
        </div> :
        <label>
          Tournament URL or slug: <input
            ref={tournamentRef}
            name="tournamentUrl"
          />
        </label>
      }
      {state.tournamentId &&
        <label>
          Event: {event && <a href={event.url}>{event.name}</a>}
          {' '}
          <select
            ref={eventRef}
            name="eventId"
            value={state.eventId || undefined}
            onKeyDown={submitOnEnter}
          >
            <option>Select Event</option>
            {state.events.map(e =>
              <option value={e.id}>{e.name}</option>
            )}
          </select>
        </label>
      }
      {state.eventId &&
        <label>
          Phase: {phase &&
            <a href={phaseGroups.length == 1 ? phaseGroups[0].url : phase.url}>{phase.name}</a>
          }
          {' '}
          <select
            ref={phaseRef}
            name="phaseId"
            value={state.phaseId || undefined}
            onKeyDown={submitOnEnter}
          >
            <option>Select Phase</option>
            {state.phases
              .filter(e => e.eventId === state.eventId)
              .map(e => <option value={e.id}>{e.name}</option>)
            }
          </select>
        </label>
      }
      {phaseGroups.length > 1 &&
        <div>
          Pools:
          {phaseGroups.map(pg => <Fragment>{' '}<a href={pg.url}>{pg.name}</a></Fragment>)}
        </div>
      }
      {state.unfinishedSets.length > 0 && <div class="bracket__sets">
        Sets:
        <ul class="bracket__set-list">
          {state.unfinishedSets.map(e => <li>{e.displayName}</li>)}
        </ul>
      </div>}
      <div class="action-row">
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default BracketDashboard;
