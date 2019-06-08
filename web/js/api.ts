function endpoint(port: string, path: string, protocol?: string): URL {
  const url = new URL(window.location.origin);
  url.port = port;
  url.pathname = path;
  if (protocol) {
    url.protocol = protocol;
  }
  return url;
}

export function infoEndpoint(path: string, protocol?: string): URL {
  return endpoint('58586', path, protocol);
}

export function recordingEndpoint(path: string, protocol?: string): URL {
  return endpoint('58587', path, protocol);
}
