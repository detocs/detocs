import throttle from 'lodash.throttle';
import { useState, useEffect, StateUpdater } from 'preact/hooks';
import { toast } from 'react-toastify';
import ReconnectingWebSocket from 'reconnecting-websocket';

const showWarning = throttle(() => {
  toast('Disconnected from server', { type: 'warning' });
}, 10 * 1000);

export function useServerState<T>(endpoint: URL, initialState: T): [ T, StateUpdater<T> ] {
  const [ state, updateState ] = useState(initialState);
  useEffect(() => {
    const ws = new ReconnectingWebSocket(endpoint.href, [], {
      maxReconnectionDelay: 60 * 1000,
      reconnectionDelayGrowFactor: 2,
      maxRetries: 40,
    });
    ws.onmessage = (ev: MessageEvent) => {
      // TODO: Compare JSON to previous state as a simple optimization
      const newState = JSON.parse(ev.data) as T;
      updateState(newState);
    };
    ws.onerror = showWarning;
    return ws.close.bind(ws);
  }, [ endpoint.href ]);
  return [ state, updateState ];
}
