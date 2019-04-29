import Person from '../../models/person';

import { infoEndpoint } from './api';
import { cloneTemplate } from './dom-util';

const idRegex = /\{(\d+)\}/;
let playerFieldsCounter = 0;

export default class PlayerFields extends HTMLElement {
  private fragment: DocumentFragment;
  private idField: HTMLInputElement;
  private handleField: HTMLInputElement;
  private prefixField: HTMLInputElement;
  private autocomplete: HTMLDataListElement;

  private constructor() {
    super();
    this.fragment = cloneTemplate('player-fields');
    const idField = this.fragment.querySelector('[name="players[][id]"]');
    const handleField = this.fragment.querySelector('[name="players[][handle]"]');
    const prefixField = this.fragment.querySelector('[name="players[][prefix]"]');
    if (!idField || !handleField || !prefixField) {
      throw new Error('Template not loaded correctly');
    }
    this.idField = idField as HTMLInputElement;
    this.handleField = handleField as HTMLInputElement;
    this.prefixField = prefixField as HTMLInputElement;

    this.autocomplete = document.createElement('datalist');
    this.autocomplete.id = PlayerFields.nextId();
    this.handleField.setAttribute('list', this.autocomplete.id);
    this.fragment.append(this.autocomplete);
  }

  private connectedCallback(): void {
    this.append(this.fragment);
    this.handleField.addEventListener('input', this.handleInput.bind(this));
  }

  private handleInput(): void {
    const value = this.handleField.value;
    const match = idRegex.exec(value);
    if (match) {
      const id = match[1];
      fetch(infoEndpoint(`/people/${id}`).href)
        .catch(console.error)
        .then(resp => resp && resp.json())
        .then(this.updatePerson.bind(this));
      return;
    }
    this.idField.value = '';
    if (value.length > 1) {
      const url = infoEndpoint('/people');
      url.search = `q=${encodeURIComponent(value)}`;
      fetch(url.href)
        .catch(console.error)
        .then(resp => resp && resp.json())
        .then(people => PlayerFields.updateDataList(this.autocomplete, people));
    }
  }

  public updatePerson(person: Person): void {
    this.idField.value = person.id == null ? '' : person.id.toString();
    this.handleField.value = person.handle;
    this.prefixField.value = person.prefix || '';
  }

  private static updateDataList(elem: HTMLDataListElement, people: Person[]): void {
    const range = document.createRange();
    range.selectNodeContents(elem);
    range.deleteContents();
    elem.append(...people.map(p => {
      const prefix = p.prefix ? `${p.prefix} | ` : '';
      return new Option(`${prefix}${p.handle}`, `{${p.id}}`);
    }));
  }
  
  private static nextId(): string {
    return `pf-${playerFieldsCounter++}`;
  }
}
