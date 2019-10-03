import RecordingState from '../../../server/recording/state';

import { useSubstate } from './substate';

export const useStartTimestamp = useSubstate<RecordingState, string | null>(
  state => state.startTimestamp,
  (state, value) => state.startTimestamp = value,
);
export const useStopTimestamp = useSubstate<RecordingState, string | null>(
  state => state.stopTimestamp,
  (state, value) => state.stopTimestamp = value,
);
