import { StateUpdater } from 'preact/hooks/src';

import RecordingState, { Recording } from '../../../server/recording/state';

import { useSubstate } from './substate';

export const useRecording = (
  value: RecordingState,
  updater: StateUpdater<RecordingState>,
  index: number,
): [Recording, StateUpdater<Recording>] =>
  useSubstate<RecordingState, Recording>(
    state => state.recordings[index],
    (state, value) => state.recordings[index] = value,
  )(value, updater);

export const useStartTimestamp = useSubstate<Recording, string>(
  recording => recording.startTimestamp,
  (recording, value) => recording.startTimestamp = value,
);
export const useStopTimestamp = useSubstate<Recording, string | null>(
  recording => recording.stopTimestamp,
  (recording, value) => recording.stopTimestamp = value,
);
