import Game, { nullGame } from '@models/game';
import { checkResponseStatus } from '@util/ajax';

import { infoEndpoint } from './api';
import AutocompleteFields from './autocomplete-fields';
import { logError } from './log';

export default class GameFields extends AutocompleteFields<Game> {
  public constructor() {
    super('game', 'Game', nullGame);
    loadGameList()
      .then(this.setOptions.bind(this))
      .catch(logError);
  }
}

function loadGameList(): Promise<Game[]> {
  return fetch(infoEndpoint('/games').href)
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<Game[]>);
}
