import { ImageFile } from '@models/media';
import { Id } from '@util/id';

import InfoState from '@server/info/state';
import { Timestamp } from '@models/timestamp';

export default interface State {
  recordings: Recording[];
  recordingGroups: RecordingGroup[];
}

export const nullState: State = Object.freeze({
  recordings: [],
  recordingGroups: [],
});

/** Set recording */
export interface Recording {
  id: Id;
  streamRecordingFile: string;
  recordingFile: string | null;
  startTimestamp: Timestamp;
  stopTimestamp: Timestamp | null;
  startThumbnail: ImageFile | null;
  stopThumbnail: ImageFile | null;
  displayName: string;
  metadata: InfoState | null;
  vodThumbnailTimestamp: Timestamp | null;
}

export interface RecordingGroup {
  id: Id;
  streamRecordingFile: string;
  startTimestamp: Timestamp;
  stopTimestamp: Timestamp | null;
  startThumbnail: ImageFile | null;
  stopThumbnail: ImageFile | null;
  vodThumbnailTimestamp: Timestamp | null;
}
