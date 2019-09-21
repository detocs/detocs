import { useState, useEffect, StateUpdater } from 'preact/hooks';

import ClientState, { nullState } from '../../../server/twitter/client-state';

import { twitterEndpoint } from '../api';


export function useServerState<T>(endpoint: URL, initialState: T): [ T, StateUpdater<T> ] {
  const [ state, updateState ] = useState(initialState);
  useEffect(() => {
    const ws = new WebSocket(twitterEndpoint('', 'ws:').href);
    ws.onmessage = (ev: MessageEvent) => {
      const newState = (JSON.parse(ev.data) as T);
      updateState(newState);
    };
    ws.onerror = console.error;
    return ws.close.bind(ws);
  }, []);
  return [ state, updateState ];
}
