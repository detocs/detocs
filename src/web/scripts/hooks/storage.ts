import { StateUpdater, useState, useEffect } from 'preact/hooks';

export const useLocalStorage: <T>(key: string, defaultValue: T) => [ T, StateUpdater<T> ] =
  (...args) => useStorage(window.localStorage, ...args);

export const useSessionStorage: <T>(key: string, defaultValue: T) => [ T, StateUpdater<T> ] =
  (...args) => useStorage(window.sessionStorage, ...args);

function useStorage<T>(
  storage: Storage,
  key: string,
  defaultValue: T,
): [ T, StateUpdater<T> ] {
  const [ val, stateUpdater ] = useState(
    parseValue(storage.getItem(key)) ?? defaultValue
  );
  const storageUpdater: StateUpdater<T> = (valueOrUpdater): void => {
    let v: T;
    if (typeof valueOrUpdater === 'function') {
      v = (valueOrUpdater as (prevState: T) => T)(val);
    } else {
      v = valueOrUpdater;
    }
    stateUpdater(v);
    storage.setItem(key, JSON.stringify(v));
  };
  useEffect(() => {
    const handleEvent = (event: StorageEvent): void => {
      if (event.key !== key) {
        return;
      }
      stateUpdater(parseValue(event.newValue) ?? defaultValue);
    };
    window.addEventListener('storage', handleEvent);
    return () => window.removeEventListener('storage', handleEvent);
  }, []);

  return [ val, storageUpdater ];
}

function parseValue<T>(value: string | null): T | null {
  return JSON.parse(value ?? 'null');
}
