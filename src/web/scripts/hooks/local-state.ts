import { StateUpdater, useState, useEffect } from 'preact/hooks';

const IDENTITY = <T>(x: T): T => x;
const DEFAULT_OPTIONS = {
  transform: IDENTITY,
  keyGenerator: IDENTITY,
};

export function useLocalState<T>(
  state: T,
  {
    transform = IDENTITY,
    keyGenerator = IDENTITY,
  }: {
    transform?: (input: T) => T,
    keyGenerator?: (input: T) => unknown,
  } = DEFAULT_OPTIONS,
): [ T, StateUpdater<T> ] {
  const [ localState, updateLocalState ] = useState(() => transform(state));
  const key = keyGenerator(state);
  useEffect(() => {
    updateLocalState(transform(state));
  // Omitting transform and state from the dependency array is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ key ]);
  return [ localState, updateLocalState ];
}
