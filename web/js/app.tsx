import { h, render, Component, ComponentChild, Fragment } from 'preact';

import LowerThird from '../../models/lower-third';
import Person, { PersonUpdate } from '../../models/person';
import Scoreboard from '../../models/scoreboard';
import { massagedFormData } from '../../util/forms';
import { getVersion } from "../../util/meta";

import { infoEndpoint } from './api';
import CommentaryDashboard from './commentary-dashboard';
import GameFieldsElement from './game-fields';
import MatchFieldsElement from './match-fields';
import { PersistentCheckboxElement } from './persistent-checkbox';
import { PersonFieldsElement } from './person-fields';
import PlayerDashboard from './player-dashboard';
import { PlayerFieldsElement } from './player-fields';
import RecordingDashboard from './recording-dashboard';
import RecordingFieldsElement from './recording-fields';
import Tab from './tab';
import TabController from './tab-controller';
import TwitterDashboardElement from './twitter-dash';
import TwitterDashboard from './twitter-dashboard';

type ResponseHandler = (data: any, form: HTMLElement) => void;

let updateID: string;

customElements.define('game-fields', GameFieldsElement);
customElements.define('match-fields', MatchFieldsElement);
customElements.define('persistent-checkbox', PersistentCheckboxElement, { extends: 'input' });
customElements.define('person-fields', PersonFieldsElement);
customElements.define('player-fields', PlayerFieldsElement);
customElements.define('recording-fields', RecordingFieldsElement);
customElements.define('twitter-dashboard', TwitterDashboardElement);

document.addEventListener('DOMContentLoaded', () => {
  render(<App />, document.body);

  bindForms('.js-scoreboard', '/scoreboard', handleScoreboardUpdateResponse);
  bindForms('.js-lowerthird', '/lowerthird', handleLowerThirdUpdateResponse);
  bindPlayerSwapButton();
  bindPlayerResetButtons();
  bindCommentatorSwapButton();
  bindCommentatorResetButton();
});

interface AppState {
  version: string;
}

class App extends Component<{}, AppState> {
  private constructor(props: {}) {
    super(props);
    this.state = {
      version: getVersion(),
    };
  }

  public render(_: {}, state: AppState): ComponentChild {
    return (
      <Fragment>
        <TabController>
          <Tab id="scoreboard">
            <PlayerDashboard/>
          </Tab>
          <Tab id="commentary">
            <CommentaryDashboard/>
          </Tab>
          <Tab id="recording">
            <RecordingDashboard/>
          </Tab>
          <Tab id="twitter">
            <TwitterDashboard/>
          </Tab>
        </TabController>
        <footer id="version">DETOCS {state.version}</footer>
      </Fragment>
    );
  }
}

function bindForms(formSelector: string, endpoint: string, responseHandler: ResponseHandler): void {
  const forms = document.querySelectorAll(formSelector) as NodeListOf<HTMLFormElement>;
  for (const form of forms) {
    bindForm(form, endpoint, responseHandler);
  }
}

function bindForm(form: HTMLFormElement, endpoint: string, responseHandler: ResponseHandler): void {
  form.onsubmit = (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    let data = new FormData(form);
    data = massagedFormData(data);
    fetch(infoEndpoint(endpoint).href, { method: 'POST', body: data })
      .catch(alert)
      .then(res => res && res.json())
      .then(data => responseHandler(data, form));
  };
}

interface ScoreboardUpdateResponse {
  readonly 'updateId': string;
  readonly 'scoreboard': Scoreboard;
}

function handleScoreboardUpdateResponse(data: ScoreboardUpdateResponse, form: HTMLElement): void {
  console.log(data);
  updateID = data['updateId'];
  updatePeopleFields(data['scoreboard'].players.map(p => p.person), form);
}

interface LowerThirdUpdateResponse {
  readonly 'updateId': string;
  readonly 'lowerThird': LowerThird;
}

function handleLowerThirdUpdateResponse(data: LowerThirdUpdateResponse, form: HTMLElement): void {
  console.log(data);
  updateID = data['updateId'];
  updatePeopleFields(data['lowerThird'].commentators.map(p => p.person), form);
}

function updatePeopleFields(people: Person[], form: HTMLElement): void {
  // Update person fields in the form that was just submitted
  const elems = [
    ...form.querySelectorAll('person-fields') as NodeListOf<PersonFieldsElement>,
    ...form.querySelectorAll('player-fields') as NodeListOf<PlayerFieldsElement>,
  ];
  for (let i = 0; i < elems.length; i++) {
    elems[i].updatePerson(people[i]);
  }

  // Update person fields in other forms if IDs match
  people = people.filter(p => p.id != null);
  if (people.length === 0) {
    return;
  }
  const allPersonFields: NodeListOf<PersonFieldsElement> =
      document.querySelectorAll('person-fields');
  for (let elem of allPersonFields) {
    if (form.contains(elem)) {
      continue;
    }
    const person = people.find(p => p.id === elem.getId());
    if (!person) {
      continue;
    }
    elem.updatePerson(person);
  }
  const allPlayerFields: NodeListOf<PlayerFieldsElement> =
      document.querySelectorAll('player-fields');
  for (let elem of allPlayerFields) {
    if (form.contains(elem)) {
      continue;
    }
    const person = people.find(p => p.id === elem.state.person.id);
    if (!person) {
      continue;
    }
    elem.updatePerson(person);
  }
}

function bindPlayerSwapButton(): void {
  const button = document.getElementsByClassName('js-swap-players')[0];
  button.addEventListener('click', () => {
    const playerFields: PlayerFieldsElement[] = Array.from(
      document.querySelectorAll('.js-scoreboard player-fields'));
    const a = playerFields[0].state;
    const b = playerFields[1].state;
    [ a.person, b.person ] = [ b.person, a.person ];
    [ a.score, b.score ] = [ b.score, a.score ];
    [ a.inLosers, b.inLosers ] = [ b.inLosers, a.inLosers ];
    [ a.comment, b.comment ] = [ b.comment, a.comment ];
    playerFields.forEach(p => p.render());
  });
}

function bindCommentatorSwapButton(): void {
  const button = document.getElementsByClassName('js-swap-commentators')[0];
  button.addEventListener('click', () => {
    const fields: PersonFieldsElement[] = Array.from(
      document.querySelectorAll('.js-commentator person-fields'));
    const temp = fields[0].getPerson();
    fields[0].updatePerson(fields[1].getPerson());
    fields[1].updatePerson(temp);
  });
}

function bindPlayerResetButtons(): void {
  const resetPlayers = document.getElementsByClassName('js-reset-players')[0];
  resetPlayers.addEventListener('click', () => {
    const fields: PlayerFieldsElement[] = Array.from(
      document.querySelectorAll('.js-scoreboard player-fields'));
    fields.forEach(f => f.reset());
  });

  const resetScores = document.getElementsByClassName('js-reset-scores')[0];
  resetScores.addEventListener('click', () => {
    const fields: PlayerFieldsElement[] = Array.from(
      document.querySelectorAll('.js-scoreboard player-fields'));
    fields.forEach(f => f.resetScore());
  });
}

function bindCommentatorResetButton(): void {
  const resetCommentators = document.getElementsByClassName('js-reset-commentators')[0];
  resetCommentators.addEventListener('click', () => {
    const fields: PersonFieldsElement[] = Array.from(
      document.querySelectorAll('.js-lowerthird person-fields'));
    fields.forEach(f => f.updatePerson({}));
  });
}
