const SERVER_PORT = String(58586);

let updateID: string;

document.addEventListener('DOMContentLoaded', () => {
  const forms = document.getElementsByClassName('js-scoreboard') as HTMLCollectionOf<HTMLFormElement>;
  for (const form of forms) {
    form.onsubmit = (event: Event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      const data = new FormData(form);
      const url = new URL(window.location.origin);
      url.port = SERVER_PORT;
      url.pathname = '/match';
      fetch(url.href, { method: 'POST', body: data })
          .then(res => res.json().then(saveUpdateId))
          .catch(alert);
    }
  }
});

interface UpdateResponse {
  readonly 'updateId': string;
}

function saveUpdateId(data: UpdateResponse) {
  console.log(data);
  updateID = data['updateId'];
}