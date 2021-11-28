import { checkResponseStatus } from '@util/ajax';
import { massagedFormData } from '@util/forms';

import { logError } from './log';

const ACTION_ATTR = 'currentAction';
const METHOD_ATTR = 'currentMethod';

export function bindSubmitHandler(): void {
  document.addEventListener('click', (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (!target.matches('form [type="submit"]')) {
      return;
    }
    const form = target.closest('form');
    if (!form) {
      return;
    }
    setFormRoute(form, target.attributes);
  }, {
    capture: true,
    passive: true,
  });
  document.addEventListener('submit', (event: Event) => {
    const form = event.target as HTMLFormElement;
    if (form.classList.contains('js-manual-form')) {
      return;
    }
    const { action, method } = getFormRoute(form);
    const body = massagedFormData(new FormData(form));
    fetch(action, { method, body })
      .then(checkResponseStatus)
      .catch(logError);

    event.preventDefault();
  });
}

function setFormRoute(form: HTMLFormElement, attributes: NamedNodeMap): void {
  const actionAttr = attributes.getNamedItem('formaction');
  const methodAttr = attributes.getNamedItem('formmethod');
  const action = actionAttr && actionAttr.value;
  const method = methodAttr && methodAttr.value;
  if (action) {
    form.dataset[ACTION_ATTR] = action;
  }
  else {
    delete form.dataset[ACTION_ATTR];
  }
  if (method) {
    form.dataset[METHOD_ATTR] = method;
  }
  else {
    delete form.dataset[METHOD_ATTR];
  }
}

function getFormRoute(form: HTMLFormElement): { action: string; method: string; } {
  const action = form.dataset[ACTION_ATTR] || form.action;
  const method = form.dataset[METHOD_ATTR] || form.method;
  return { action, method };
}
