export default interface State {
  recordingFolder: string | null;
  recordingFile: string | null;
  clipFile: string | null;
  startTimestamp: string | null;
  stopTimestamp: string | null;
  startThumbnail: string | null;
  stopThumbnail: string | null;
}

export const nullState: State = {
  recordingFolder: null,
  recordingFile: null,
  clipFile: null,
  startTimestamp: null,
  stopTimestamp: null,
  startThumbnail: null,
  stopThumbnail: null,
};
