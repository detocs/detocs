import { StateUpdater, useState, useEffect } from 'preact/hooks';

export function useLocalState<T>(
  state: T,
  transform: (input: T) => T = x => x,
): [ T, StateUpdater<T> ] {
  const [ localState, updateLocalState ] = useState(transform(state));
  useEffect(() => {
    updateLocalState(transform(state));
  }, [ state ]);
  return [ localState, updateLocalState ];
}
