export type FormControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Shim that lets us pretend that the server can handle repeated keys in
 * multipart form data
 * @param data The original form data
 */
export function massagedFormData(data: FormData): FormData {
  const keyCounts = new Map();
  const ret = new FormData();
  for (let [key, value] of data.entries()) {
    if (key.includes('[]')) {
      const count = keyCounts.get(key) || 0;
      keyCounts.set(key, count + 1);
      key = key.replace('[]', `[${count}]`);
    }
    ret.set(key, value);
  }
  return ret;
}

/**
 * Submits the enclosing form
 * @param event The event to submit in response to
 */
export function submitForm(event: Event): void {
  // Not actually correct, but I can't be bothered to properly set up the types
  const target = event.target as HTMLInputElement | null;
  if (!target) {
    return;
  }
  const form = target.form || target.closest('form');
  form?.requestSubmit();
}

export function fieldSetFormData(fieldSet: HTMLFieldSetElement): FormData {
  const data = new FormData();
  for (const elem of fieldSet.elements as HTMLCollectionOf<FormControlElement>) {
    data.append(elem.name, elem.value);
  }
  return data;
}

// export function objectFormData(obj: Record<string, unknown>): FormData {
// eslint-disable-next-line @typescript-eslint/ban-types
export function objectFormData(obj: Object): FormData {
  return Object.entries(obj)
    .reduce((formData, [ key, value ]) => {
      formData.append(key, `${value}`);
      return formData;
    }, new FormData());
}
