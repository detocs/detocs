import { useState, useEffect, StateUpdater } from 'preact/hooks';

export function useServerState<T>(endpoint: URL, initialState: T): [ T, StateUpdater<T> ] {
  const [ state, updateState ] = useState(initialState);
  useEffect(() => {
    const ws = new WebSocket(endpoint.href);
    ws.onmessage = (ev: MessageEvent) => {
      const newState = JSON.parse(ev.data) as T;
      updateState(newState);
    };
    ws.onerror = console.error;
    return ws.close.bind(ws);
  }, []);
  return [ state, updateState ];
}
