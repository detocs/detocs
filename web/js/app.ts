import LowerThird from '../../models/lower-third';
import Person from '../../models/person';
import Scoreboard from '../../models/scoreboard';

import { infoEndpoint } from './api';
import GameFieldsElement from './game-fields';
import PlayerFields from './player-fields';
import RecordingFieldsElement from './recording-fields';
import TabController from './tab-controller';

type ResponseHandler = (data: any, form: HTMLElement) => void;

let updateID: string;

customElements.define('game-fields', GameFieldsElement);
customElements.define('player-fields', PlayerFields);
customElements.define('recording-fields', RecordingFieldsElement);
customElements.define('tab-controller', TabController);

document.addEventListener('DOMContentLoaded', () => {
  bindForms('.js-scoreboard', '/scoreboard', handleScoreboardUpdateResponse);
  bindForms('.js-lowerthird', '/lowerthird', handleLowerThirdUpdateResponse);
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
  const elems: NodeListOf<PlayerFields> = form.querySelectorAll('player-fields');
  for (let i = 0; i < elems.length; i++) {
    elems[i].updatePerson(people[i]);
  }

  // Update person fields in other forms if IDs match
  const allElems: NodeListOf<PlayerFields> = document.querySelectorAll('player-fields');
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
