import updateImmutable from 'immutability-helper';
import { StateUpdater } from 'preact/hooks';

import RecordingState, { Recording, RecordingGroup } from '@server/recording/state';

import { useLocalState } from './local-state';
import { createSubstatehook } from './substate';
import { Id } from '@util/id';

export const useRecording = (
  value: RecordingState,
  updater: StateUpdater<RecordingState>,
  id: Id,
): [Recording, StateUpdater<Recording>] =>
  createSubstatehook<RecordingState, Recording>(
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

const useStartTimestampSubstate = createSubstatehook<Recording, string>(
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

const useStopTimestampSubstate = createSubstatehook<Recording, string | null>(
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
  createSubstatehook<RecordingState, RecordingGroup>(
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

const useGroupStartTimestampSubstate = createSubstatehook<RecordingGroup, string>(
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

const useGroupStopTimestampSubstate = createSubstatehook<RecordingGroup, string | null>(
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
