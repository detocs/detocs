import { ImageFile } from '@models/media';
import { Id } from '@util/id';

import InfoState from '@server/info/state';

export default interface State {
  recordings: Recording[];
}

export const nullState: State = Object.freeze({
  recordings: [],
});

export interface Recording {
  id: Id;
  streamRecordingFile: string;
  recordingFile: string | null;
  startTimestamp: string;
  stopTimestamp: string | null;
  startThumbnail: ImageFile | null;
  stopThumbnail: ImageFile | null;
  displayName: string | null;
  metadata: InfoState | null;
}
