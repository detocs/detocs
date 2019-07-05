import LowerThird from '../../models/lower-third';
import Person, { PersonUpdate } from '../../models/person';
import Scoreboard from '../../models/scoreboard';

import { infoEndpoint } from './api';
import GameFieldsElement from './game-fields';
import MatchFieldsElement from './match-fields';
import PersistentCheckbox from './persistent-checkbox';
import PersonFields from './person-fields';
import RecordingFieldsElement from './recording-fields';
import TabController from './tab-controller';

type ResponseHandler = (data: any, form: HTMLElement) => void;

let updateID: string;

customElements.define('game-fields', GameFieldsElement);
customElements.define('match-fields', MatchFieldsElement);
customElements.define('persistent-checkbox', PersistentCheckbox, { extends: 'input' });
customElements.define('person-fields', PersonFields);
customElements.define('recording-fields', RecordingFieldsElement);
customElements.define('tab-controller', TabController);

document.addEventListener('DOMContentLoaded', () => {
  bindForms('.js-scoreboard', '/scoreboard', handleScoreboardUpdateResponse);
  bindForms('.js-lowerthird', '/lowerthird', handleLowerThirdUpdateResponse);
  bindPlayerSwapButton();
  bindCommentatorSwapButton();
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
  const elems: NodeListOf<PersonFields> = form.querySelectorAll('person-fields');
  for (let i = 0; i < elems.length; i++) {
    elems[i].updatePerson(people[i]);
  }

  // Update person fields in other forms if IDs match
  const allElems: NodeListOf<PersonFields> = document.querySelectorAll('person-fields');
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

interface PlayerState {
  person: PersonUpdate;
  score: number;
  inLosers?: boolean;
  comment?: string;
}

function bindPlayerSwapButton(): void {
  const button = document.getElementsByClassName('js-swap-players')[0];
  button.addEventListener('click', () => {
    const playerRoots = Array.from(document.getElementsByClassName('js-player'));
    const playerStates = playerRoots.map(getPlayerState);
    [ playerStates[0], playerStates[1] ] = [ playerStates[1], playerStates[0] ];
    playerRoots.forEach((root, i) => {
      setPlayerState(root, playerStates[i]);
    });
  });
}

function getPlayerState(parent: Element): PlayerState {
  const personFields: PersonFields | null = parent.querySelector('person-fields');
  if (!personFields) {
    throw new Error('person-fields not present');
  }
  const person = personFields.getPerson();

  const scoreInput: HTMLInputElement | null = parent.querySelector('input[name$="[score]"');
  const score = scoreInput ? +scoreInput.value : 0;

  const losersInput: HTMLInputElement | null = parent.querySelector('input[name$="[inLosers]"]');
  const inLosers = losersInput ? losersInput.checked : false;

  const commentInput: HTMLInputElement | null = parent.querySelector('input[name$="[comment]"');
  const comment = commentInput ? commentInput.value : '';

  return { person, score, inLosers, comment };
}

function setPlayerState(parent: Element, state: PlayerState): void {
  const personFields: PersonFields | null = parent.querySelector('person-fields');
  if (!personFields) {
    throw new Error('person-fields not present');
  }
  personFields.updatePerson(state.person);

  const scoreInput: HTMLInputElement | null = parent.querySelector('input[name$="[score]"');
  scoreInput && (scoreInput.value = `${state.score}`);

  const losersInput: HTMLInputElement | null = parent.querySelector('input[name$="[inLosers]"]');
  losersInput && (losersInput.checked = state.inLosers || false);

  const commentInput: HTMLInputElement | null = parent.querySelector('input[name$="[comment]"');
  commentInput && (commentInput.value = state.comment || '');
}

function bindCommentatorSwapButton(): void {
  const button = document.getElementsByClassName('js-swap-commentators')[0];
  button.addEventListener('click', () => {
    const fields: PersonFields[] = Array.from(
      document.querySelectorAll('.js-commentator person-fields'));
    const temp = fields[0].getPerson();
    fields[0].updatePerson(fields[1].getPerson());
    fields[1].updatePerson(temp);
  });
}
