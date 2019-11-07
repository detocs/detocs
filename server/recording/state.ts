import InfoState from '../info/state';

export default interface State {
  streamRecordingFolder: string | null;
  streamRecordingFile: string | null;
  recordings: Recording[];
}

export const nullState: State = Object.freeze({
  streamRecordingFolder: null,
  streamRecordingFile: null,
  recordings: [],
});

export interface Recording {
  id: string;
  streamRecordingFile: string;
  recordingFile: string | null;
  startTimestamp: string;
  stopTimestamp: string | null;
  startThumbnail: string | null;
  stopThumbnail: string | null;
  displayName: string | null;
  metadata: InfoState | null;
}
