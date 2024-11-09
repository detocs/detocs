import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater, useRef, useEffect } from 'preact/hooks';

import BracketState, { nullState } from '@server/bracket/state';
import { checkResponseStatus } from '@util/ajax';
import { keyHandler, Key } from '@util/dom';
import { submitForm } from '@util/forms';

import { bracketEndpoint } from './api';
import ExternalLink from './external-link';
import Icon from './icon';
import { logError } from './log';

interface Props {
  state: BracketState;
  updateState: StateUpdater<BracketState>;
}

const submitOnEnter = keyHandler({
  [Key.Enter]: submitForm,
});

async function ajaxReset(): Promise<void> {
  fetch(updateEndpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'tournamentUrl=',
    }
  )
    .then(checkResponseStatus)
    .catch(logError);
}

const updateEndpoint = bracketEndpoint('/update').href;
const BracketDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const clearTournament = (): void => {
    updateState(nullState);
    ajaxReset();
  };
  // TODO: Local state?
  const tournament = state.tournament;
  const event = state.eventId ? state.events.find(e => e.id === state.eventId) : null;
  const phase = state.phaseId ? state.phases.find(p => p.id === state.phaseId) : null;
  const phaseGroups = state.phaseId ?
    state.phaseGroups.filter(pg => pg.phaseId === state.phaseId) :
    [];
  const tournamentRef = useRef<HTMLInputElement>(null);
  const eventRef = useRef<HTMLSelectElement>(null);
  const phaseRef = useRef<HTMLSelectElement>(null);
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
      action={updateEndpoint}
      method="post"
      autocomplete="off"
      class="bracket__container"
    >
      {state.tournamentId ?
        <div>
          <input type="hidden" name="tournamentId" value={state.tournamentId}/>
          Tournament: {tournament ?
            <ExternalLink href={tournament.url}>{tournament.name}</ExternalLink> :
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
          Event: {event && <ExternalLink href={event.url}>{event.name}</ExternalLink>}
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
            <ExternalLink href={phaseGroups.length == 1 ? phaseGroups[0].url : phase.url}>
              {phase.name}
            </ExternalLink>
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
          <ul class="bracket__pool-list">
            {phaseGroups.map(pg =>
              <li>
                <label>
                  <input
                    type="checkbox"
                    name="phaseGroupIds[]"
                    id={`pool-${pg.id}`}
                    value={pg.id}
                    checked={state.phaseGroupIds.includes(pg.id)}
                  />
                  {' '}
                  {pg.name}
                </label>
                <ExternalLink href={pg.url}><Icon name="external" label={`Pool ${pg.name}`} /></ExternalLink>
              </li>
            )}
          </ul>
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
