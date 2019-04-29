import { infoEndpoint } from './api';
import { cloneTemplate } from './dom-util';

const idRegex = /\{(\d+)\}/;
let playerFieldsCounter = 0;

class PlayerFields extends HTMLElement {
  private connectedCallback(): void {
    cloneTemplate('player-fields', this);
    const idField = this.querySelector('[name="players[][id]"]') as HTMLInputElement;
    const handleField = this.querySelector('[name="players[][handle]"]') as HTMLInputElement;
    const prefixField = this.querySelector('[name="players[][prefix]"]') as HTMLInputElement;

    const autocomplete = document.createElement('datalist');
    autocomplete.id = PlayerFields.nextId();
    handleField.setAttribute('list', autocomplete.id);
    this.append(autocomplete);

    handleField && handleField.addEventListener('input', () => {
      const value = handleField.value;
      const match = idRegex.exec(value);
      if (match) {
        const id = match[1];
        fetch(infoEndpoint(`/people/${id}`).href)
          .catch(console.error)
          .then(resp => resp && resp.json())
          .then(person => {
            idField.value = person.id;
            handleField.value = person.handle;
            prefixField.value = person.prefix;
          });
        return;
      }

      idField.value = '';
      if (value.length > 1) {
        const url = infoEndpoint('/people');
        url.search = `q=${encodeURIComponent(value)}`
        fetch(url.href)
          .catch(console.error)
          .then(resp => resp && resp.json())
          .then(people => PlayerFields.updateDataList(autocomplete, people));
      }
    });
  }

  private static updateDataList(elem: HTMLDataListElement, people: any[]): void {
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
customElements.define('player-fields', PlayerFields);
