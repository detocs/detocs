import Game, { nullGame } from '@models/game.ts';
import { checkResponseStatus } from '@util/ajax.ts';

import { infoEndpoint } from './api.ts';
import AutocompleteFields from './autocomplete-fields.tsx';
import { logError } from './log.ts';

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
