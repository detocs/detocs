import Match, { nullMatch } from '@models/match';
import { checkResponseStatus } from '@util/ajax';

import { infoEndpoint } from './api';
import AutocompleteFields from './autocomplete-fields';
import { logError } from './log';

export default class MatchFields extends AutocompleteFields<Match> {
  public constructor() {
    super('match', 'Match', nullMatch);
    loadMatchList()
      .then(this.setOptions.bind(this))
      .catch(logError);
  }
}

function loadMatchList(): Promise<Match[]> {
  return fetch(infoEndpoint('/matches').href)
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<Match[]>);
}
