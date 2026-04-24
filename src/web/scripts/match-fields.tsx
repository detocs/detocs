import Match, { nullMatch } from '@models/match.ts';
import { checkResponseStatus } from '@util/ajax.ts';

import { infoEndpoint } from './api.ts';
import AutocompleteFields from './autocomplete-fields.tsx';
import { logError } from './log.ts';

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
