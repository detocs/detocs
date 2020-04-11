import {
  INFO_PORT,
  RECORDING_PORT,
  TWITTER_PORT,
  BRACKETS_PORT,
  MEDIA_DASHBOARD_PORT
} from "../../server/ports";

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
  return endpoint(INFO_PORT.toString(), path, protocol);
}

export function recordingEndpoint(path: string, protocol?: string): URL {
  return endpoint(RECORDING_PORT.toString(), path, protocol);
}

export function twitterEndpoint(path: string, protocol?: string): URL {
  return endpoint(TWITTER_PORT.toString(), path, protocol);
}

export function bracketEndpoint(path: string, protocol?: string): URL {
  return endpoint(BRACKETS_PORT.toString(), path, protocol);
}

export function mediaDashboardEndpoint(path: string, protocol?: string): URL {
  return endpoint(MEDIA_DASHBOARD_PORT.toString(), path, protocol);
}
