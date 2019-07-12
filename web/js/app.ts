import LowerThird from '../../models/lower-third';
import Person, { PersonUpdate } from '../../models/person';
import Scoreboard from '../../models/scoreboard';

import { infoEndpoint } from './api';
import GameFieldsElement from './game-fields';
import MatchFieldsElement from './match-fields';
import { PersistentCheckboxElement } from './persistent-checkbox';
import { PersonFieldsElement } from './person-fields';
import { PlayerFieldsElement } from './player-fields';
import RecordingFieldsElement from './recording-fields';
import TabController from './tab-controller';

type ResponseHandler = (data: any, form: HTMLElement) => void;

let updateID: string;

customElements.define('game-fields', GameFieldsElement);
customElements.define('match-fields', MatchFieldsElement);
customElements.define('persistent-checkbox', PersistentCheckboxElement, { extends: 'input' });
customElements.define('person-fields', PersonFieldsElement);
customElements.define('player-fields', PlayerFieldsElement);
customElements.define('recording-fields', RecordingFieldsElement);
customElements.define('tab-controller', TabController);

document.addEventListener('DOMContentLoaded', () => {
  bindForms('.js-scoreboard', '/scoreboard', handleScoreboardUpdateResponse);
  bindForms('.js-lowerthird', '/lowerthird', handleLowerThirdUpdateResponse);
  bindPlayerSwapButton();
  bindPlayerResetButtons();
  bindCommentatorSwapButton();
  bindCommentatorResetButton();
});

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
    data = massagedFormDate(data);
    fetch(infoEndpoint(endpoint).href, { method: 'POST', body: data })
      .catch(alert)
      .then(res => res && res.json())
      .then(data => responseHandler(data, form));
  };
}

/**
 * Shim that lets us pretend that the server can handle repeated keys in
 * multipart form data
 * @param data The original form data
 */
function massagedFormDate(data: FormData): FormData {
  const keyCounts = new Map();
  const ret = new FormData();
  for (let [key, value] of data.entries()) {
    if (key.includes('[]')) {
      const count = keyCounts.get(key) || 0;
      keyCounts.set(key, count + 1);
      key = key.replace('[]', `[${count}]`);
    }
    ret.set(key, value);
  }
  return ret;
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
  const elems: NodeListOf<PersonFieldsElement> = form.querySelectorAll('person-fields');
  for (let i = 0; i < elems.length; i++) {
    elems[i].updatePerson(people[i]);
  }

  // Update person fields in other forms if IDs match
  const allElems: NodeListOf<PersonFieldsElement> = document.querySelectorAll('person-fields');
  for (const elem of allElems) {
    if (form.contains(elem)) {
      continue;
    }
    const person = people.find(p => p.id === elem.getId());
    if (person) {
      elem.updatePerson(person);
    }
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
