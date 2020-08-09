export async function checkResponseStatus(resp: void | Response): Promise<Response> {
  if (!resp) {
    throw new Error();
  }
  if (!resp.ok) {
    throw new Error(`${resp.status}: ${resp.statusText}\n${await resp.text()}`);
  }
  return resp;
}

export async function checkServerError(resp: void | Response): Promise<Response> {
  if (!resp) {
    throw new Error();
  }
  if (resp.status >= 500 && resp.status < 600) {
    throw new Error(`${resp.status}: ${resp.statusText}\n${await resp.text()}`);
  }
  return resp;
}
