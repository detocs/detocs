import updateImmutable from 'immutability-helper';
import { StateUpdater } from 'preact/hooks/src';

import RecordingState, { Recording } from '@server/recording/state';

import { useSubstate } from './substate';

export const useRecording = (
  value: RecordingState,
  updater: StateUpdater<RecordingState>,
  index: number,
): [Recording, StateUpdater<Recording>] =>
  useSubstate<RecordingState, Recording>(
    state => state.recordings[index],
    (state, value) => updateImmutable(
      state,
      { recordings: { [index]: { $set: value } } },
    ),
  )(value, updater);

export const useStartTimestamp = useSubstate<Recording, string>(
  recording => recording.startTimestamp,
  (recording, value) => updateImmutable(
    recording,
    { startTimestamp: { $set: value } },
  ),
);
export const useStopTimestamp = useSubstate<Recording, string | null>(
  recording => recording.stopTimestamp,
  (recording, value) => updateImmutable(
    recording,
    { stopTimestamp: { $set: value } },
  ),
);
