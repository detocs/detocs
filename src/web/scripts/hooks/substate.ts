import { StateUpdater } from 'preact/hooks';

export type SubstateTransformer<Full, Subset> =
  (state: Full, updateState: StateUpdater<Full>) => [Subset, StateUpdater<Subset>];

export function useSubstate<Full, Subset>(
  getter: (state: Readonly<Full>) => Subset,
  setter: (state: Readonly<Full>, value: Subset) => Full,
): SubstateTransformer<Full, Subset> {
  return (state, updateState) => [
    getter(state),
    valueOrUpdater => {
      let v: Subset;
      if (typeof valueOrUpdater === 'function') {
        v = (valueOrUpdater as (prevState: Subset) => Subset)(getter(state));
      } else {
        v = valueOrUpdater;
      }
      updateState(setter(state, v));
    },
  ];
}
