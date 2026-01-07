import { StateUpdater, useState, useEffect } from 'preact/hooks';

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type OptionalKeyGenerator<T> = {
  transform?: (input: T) => T;
  keyGenerator?: (input: T) => Primitive;
};
type RequiredKeyGenerator<T> = {
  transform?: (input: T) => T;
  keyGenerator: (input: T) => Primitive;
};

const IDENTITY = <T>(x: T): T => x;

export function useLocalState<T extends Primitive>(
  state: T,
  options?: OptionalKeyGenerator<T>
): [T, StateUpdater<T>];
export function useLocalState<T>(
  state: T,
  options: RequiredKeyGenerator<T>
): [T, StateUpdater<T>];
export function useLocalState<T>(
  state: T,
  {
    transform = IDENTITY,
    keyGenerator = IDENTITY,
  }: {
    transform?: (input: T) => T;
    keyGenerator?: (input: T) => unknown;
  } = {}
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
