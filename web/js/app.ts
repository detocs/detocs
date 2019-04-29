import Scoreboard from '../../models/scoreboard';

import PlayerFields from './player-fields';
import { infoEndpoint } from './api';

let updateID: string;

customElements.define('player-fields', PlayerFields);

document.addEventListener('DOMContentLoaded', () => {
  const forms = document.getElementsByClassName('js-scoreboard') as
    HTMLCollectionOf<HTMLFormElement>;
  for (const form of forms) {
    form.onsubmit = (event: Event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      let data = new FormData(form);
      data = massagedFormDate(data);
      fetch(infoEndpoint('/scoreboard').href, { method: 'POST', body: data })
        .catch(alert)
        .then(res => res && res.json())
        .then(handleUpdateResponse);
    }
  }
});

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

interface UpdateResponse {
  readonly 'updateId': string;
  readonly 'scoreboard': Scoreboard;
}

function handleUpdateResponse(data: UpdateResponse): void {
  console.log(data);
  updateID = data['updateId'];
  updatePlayerFields(data['scoreboard'].players);
}

function updatePlayerFields(players: Scoreboard['players']): void {
  const elems: NodeListOf<PlayerFields> = document.querySelectorAll('player-fields');
  for (let i = 0; i < elems.length; i++) {
    elems[i].updatePerson(players[i].person);
  }
}
