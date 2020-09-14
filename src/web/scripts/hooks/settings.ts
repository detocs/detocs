import { useLocalStorage } from './storage';
import { StateUpdater } from 'preact/hooks';

export function usePlayersReversed(): [ boolean, VoidFunction, StateUpdater<boolean> ] {
  const [ val, updater ] = useLocalStorage('players.reverse', false);
  return [ val, () => updater(v => !v), updater];
}

export function useCommentatorsReversed(): [ boolean, VoidFunction, StateUpdater<boolean> ] {
  const [ val, updater ] = useLocalStorage('commentators.reverse', false);
  return [ val, () => updater(v => !v), updater];
}
