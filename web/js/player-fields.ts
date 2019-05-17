import Person from '../../models/person';

import { infoEndpoint } from './api';

const idRegex = /\{(\d+)\}/;
let playerFieldsCounter = 0;

export default class PlayerFields extends HTMLElement {
  private fragment = document.createDocumentFragment();
  private fields: {[name: string]: HTMLInputElement} = {};
  private idField: HTMLInputElement;
  private autocomplete: HTMLDataListElement;

  private constructor() {
    super();
    this.idField = document.createElement('input');
    this.idField.type = 'hidden';
    this.idField.name = 'players[][id]';
    this.fragment.append(this.idField);

    this.autocomplete = document.createElement('datalist');
    this.autocomplete.id = PlayerFields.nextId();
    this.fragment.append(this.autocomplete);
  }

  private connectedCallback(): void {
    const fieldList: string[] = JSON.parse(this.dataset.fields || '[]');
    for (const field of fieldList) {
      const elem = PlayerFields.createFieldInput(field, PlayerFields.capitalize(field));
      this.fields[field] = elem;
      this.fragment.append(elem);
    }

    const handleField = this.fields['handle'];
    if (!handleField) {
      throw new Error('Handle field must be included');
    }
    handleField.setAttribute('list', this.autocomplete.id);
    handleField.addEventListener('input', this.handleInput.bind(this));

    this.append(this.fragment);
  }

  private handleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
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
    for (const field in this.fields) {
      let value = '';
      switch (field) {
        case 'handle':
          value = person.handle;
          break;
        case 'prefix':
          value = person.prefix || '';
          break;
        case 'twitter':
          value = person.twitter || '';
          break;
      }
      this.fields[field].value = value;
    }
  }

  public getId(): number | null {
    const val = this.idField.value;
    return val ? +val : null;
  }

  private static createFieldInput(name: string, placeholder: string): HTMLInputElement {
    const elem = document.createElement('input');
    elem.type = 'text';
    elem.name = `players[][${name}]`;
    elem.placeholder = placeholder;
    elem.className = name;
    return elem;
  }

  private static capitalize(str: string): string {
    return `${str[0].toUpperCase()}${str.substring(1)}`;
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
