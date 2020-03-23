import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';
import { Key } from 'w3c-keys';

import { TOURNAMENT_URL_REGEX, TOURNAMENT_SLUG_REGEX } from '../../models/smashgg';
import BracketState, { nullState } from '../../server/bracket/state';
import { keyHandler } from '../../util/dom';
import { submitForm } from '../../util/forms';

import { bracketEndpoint } from './api';

interface Props {
  state: BracketState;
  updateState: StateUpdater<BracketState>;
}

const TOURNAMENT_PATTERN = TOURNAMENT_URL_REGEX.source + '|' + TOURNAMENT_SLUG_REGEX.source;
const submitOnEnter = keyHandler({
  [Key.Enter]: submitForm,
});

const BracketDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const clearTournament = (): void => updateState(nullState);
  const tournament = state.tournament;
  const event = state.eventId ? state.events.find(e => e.id === state.eventId) : null;
  const phase = state.phaseId ? state.phases.find(e => e.id === state.phaseId) : null;
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
            type="text"
            name="tournamentUrl"
            pattern={TOURNAMENT_PATTERN}
          />
        </label>
      }
      {state.tournamentId &&
        <label>
          Event: {event && <a href={event.url}>{event.name}</a>}
          {' '}
          <select
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
          Phase: {phase && <a href={phase.url}>{phase.name}</a>}
          {' '}
          <select
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
      {state.unfinishedSets.length > 0 && <div class="bracket__sets">
        Sets:
        <ul class="bracket__set-list">
          {state.unfinishedSets.map(e => <li>{e.displayName}</li>)}
        </ul>
      </div>}
      <div class="input-row">
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default BracketDashboard;
