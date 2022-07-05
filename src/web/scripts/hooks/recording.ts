import updateImmutable from 'immutability-helper';
import { StateUpdater } from 'preact/hooks';

import RecordingState, { Recording } from '@server/recording/state';

import { useLocalState } from './local-state';
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


const useStartTimestampSubstate = useSubstate<Recording, string>(
  recording => recording.startTimestamp,
  (recording, value) => updateImmutable(
    recording,
    { startTimestamp: { $set: value } },
  ),
);
export const useStartTimestamp: typeof useStartTimestampSubstate = (state, updateState) => {
  return useLocalState(
    useStartTimestampSubstate(state, updateState)[0],
  );
};

const useStopTimestampSubstate = useSubstate<Recording, string | null>(
  recording => recording.stopTimestamp,
  (recording, value) => updateImmutable(
    recording,
    { stopTimestamp: { $set: value } },
  ),
);
export const useStopTimestamp: typeof useStopTimestampSubstate = (state, updateState) => {
  return useLocalState(
    useStopTimestampSubstate(state, updateState)[0],
  );
};
