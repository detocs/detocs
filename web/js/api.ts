const SERVER_PORT = String(58586);

export function infoEndpoint(path: string): URL {
  const url = new URL(window.location.origin);
  url.port = SERVER_PORT;
  url.pathname = path;
  return url;
}
