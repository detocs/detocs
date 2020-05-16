import { useState, useEffect, StateUpdater } from 'preact/hooks';
import ReconnectingWebSocket from 'reconnecting-websocket';

export function useServerState<T>(endpoint: URL, initialState: T): [ T, StateUpdater<T> ] {
  const [ state, updateState ] = useState(initialState);
  useEffect(() => {
    const ws = new ReconnectingWebSocket(endpoint.href, [], {
      maxReconnectionDelay: 60 * 1000,
      reconnectionDelayGrowFactor: 2,
      maxRetries: 40,
    });
    ws.onmessage = (ev: MessageEvent) => {
      const newState = JSON.parse(ev.data) as T;
      updateState(newState);
    };
    ws.onerror = console.error;
    return ws.close.bind(ws);
  }, []);
  return [ state, updateState ];
}
