import { h, render } from 'preact';

import Match, { nullMatch } from '../../models/match';

import { infoEndpoint } from './api';
import AutocompleteFields from './autocomplete-fields';

export default class MatchFieldsElement extends HTMLElement {
  private connectedCallback(): void {
    render(<MatchFields />, this);
  }
}

class MatchFields extends AutocompleteFields<Match> {
  public constructor() {
    super('match', 'Match', nullMatch);
    loadMatchList().then(this.setOptions.bind(this));
  }
}

function loadMatchList(): Promise<Match[]> {
  return fetch(infoEndpoint('/matches').href)
    .catch(console.error)
    .then(resp => resp ? resp.json() as Promise<Match[]> : Promise.reject());
}
