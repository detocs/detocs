const SERVER_PORT = String(58586);

let updateID: string;

document.addEventListener('DOMContentLoaded', () => {
  const forms = document.getElementsByClassName('js-scoreboard') as
    HTMLCollectionOf<HTMLFormElement>;
  for (const form of forms) {
    form.onsubmit = (event: Event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      let data = new FormData(form);
      data = massagedFormDate(data);
      console.log(Array.from(data.entries()));
      fetch(infoEndpoint('/scoreboard').href, { method: 'POST', body: data })
        .then(res => res.json().then(saveUpdateId))
        .catch(alert);
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
    console.log(key, value);
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
}

function infoEndpoint(path: string): URL {
  const url = new URL(window.location.origin);
  url.port = SERVER_PORT;
  url.pathname = path;
  return url;
}

function saveUpdateId(data: UpdateResponse): void {
  console.log(data);
  updateID = data['updateId'];
}

const idRegex = /\{(\d+)\}/;

let playerFieldsCounter = 0;
class PlayerFields extends HTMLElement {
  private connectedCallback(): void {
    this.cloneTemplate('player-fields');
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

  private cloneTemplate(id: string): void {
    const template = document.getElementById(id) as HTMLTemplateElement;
    this.appendChild(template.content.cloneNode(true));
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
