import { StateUpdater } from 'preact/hooks';

export type SubstateTransformer<Full, Subset> =
  (state: Full, updateState: StateUpdater<Full>) => [Subset, StateUpdater<Subset>];

export function createSubstatehook<Full, Subset>(
  getter: (state: Readonly<Full>) => Subset,
  setter: (state: Readonly<Full>, value: Subset) => Full,
): SubstateTransformer<Full, Subset> {
  return (state, updateState) => [
    getter(state),
    valueOrUpdater => {
      if (typeof valueOrUpdater === 'function') {
        const updater = valueOrUpdater as (prevState: Subset) => Subset;
        updateState(origState => setter(origState, updater(getter(origState))));
      } else {
        const value = valueOrUpdater as Subset;
        updateState(origState => setter(origState, value));
      }
    },
  ];
}
