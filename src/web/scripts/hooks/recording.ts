import updateImmutable from 'immutability-helper';
import { StateUpdater } from 'preact/hooks';

import RecordingState, { Recording, RecordingGroup } from '@server/recording/state';

import { useLocalState } from './local-state';
import { useSubstate } from './substate';
import { Id } from '@util/id';
import { ImageFile } from '@models/media';
import { Timestamp } from '@models/timestamp';

export const useRecording = (
  value: RecordingState,
  updater: StateUpdater<RecordingState>,
  id: Id,
): [Recording, StateUpdater<Recording>] =>
  useSubstate<RecordingState, Recording>(
    state => {
      const rec = state.recordings.find(r => r.id === id);
      if (!rec) {
        throw new Error(`Recording with id "${id}" not found`);
      }
      return rec;
    },
    (state, value) => {
      const index = state.recordings.findIndex(r => r.id === id);
      if (index == -1) {
        throw new Error(`Recording with id "${id}" not found`);
      }
      return updateImmutable(
        state,
        { recordings: { [index]: { $set: value } } },
      );
    },
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

export const useRecordingGroup = (
  value: RecordingState,
  updater: StateUpdater<RecordingState>,
  id: Id,
): [RecordingGroup, StateUpdater<RecordingGroup>] =>
  useSubstate<RecordingState, RecordingGroup>(
    state => {
      const rec = state.recordingGroups.find(r => r.id === id);
      if (!rec) {
        throw new Error(`Recording group with id "${id}" not found`);
      }
      return rec;
    },
    (state, value) => {
      const index = state.recordingGroups.findIndex(r => r.id === id);
      if (index == -1) {
        throw new Error(`Recording group with id "${id}" not found`);
      }
      return updateImmutable(
        state,
        { recordingGroups: { [index]: { $set: value } } },
      );
    },
  )(value, updater);

const useGroupStartTimestampSubstate = useSubstate<RecordingGroup, string>(
  group => group.startTimestamp,
  (group, value) => updateImmutable(
    group,
    { startTimestamp: { $set: value } },
  ),
);
export const useGroupStartTimestamp: typeof useGroupStartTimestampSubstate = (
  state,
  updateState,
) => {
  return useLocalState(
    useGroupStartTimestampSubstate(state, updateState)[0],
  );
};

const useGroupStopTimestampSubstate = useSubstate<RecordingGroup, string | null>(
  group => group.stopTimestamp,
  (group, value) => updateImmutable(
    group,
    { stopTimestamp: { $set: value } },
  ),
);
export const useGroupStopTimestamp: typeof useGroupStopTimestampSubstate = (state, updateState) => {
  return useLocalState(
    useGroupStopTimestampSubstate(state, updateState)[0],
  );
};
