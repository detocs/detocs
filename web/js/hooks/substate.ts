import { StateUpdater } from 'preact/hooks';

export function useSubstate<Full, Subset>(
  getter: (state: Full) => Subset,
  setter: (state: Full, value: Subset) => void,
): (state: Full, updateState: StateUpdater<Full>) => [Subset, StateUpdater<Subset>] {
  return (state, updateState) => [
    getter(state),
    valueOrUpdater => {
      let v: Subset;
      if (typeof valueOrUpdater === 'function') {
        v = (valueOrUpdater as (prevState: Subset) => Subset)(getter(state));
      } else {
        v = valueOrUpdater;
      }
      const newState = Object.assign({}, state);
      setter(newState, v);
      updateState(newState);
    },
  ];
}
