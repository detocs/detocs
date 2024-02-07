import { ResultAsync } from 'neverthrow';

import { Timestamp } from '@models/timestamp';

export interface ImageData {
  width: number;
  height: number;
  data: Buffer;
}

export interface Scene {
  name: string;
}

export interface VideoInput {
  name: string;
}

export default interface VisionMixer {
  name(): string;
  connect(): ResultAsync<void, Error>;
  disconnect(): ResultAsync<void, Error>;
  isConnected(): boolean;
  onConnect(cb: () => void): void;

  // TODO: Distinguish between canvas and video resolution
  getOutputDimensions(): ResultAsync<{ width: number; height: number }, Error>;

  getSceneList(): ResultAsync<Scene[], Error>;
  onSceneListUpdate(cb: (scenes: Scene[]) => void): void;
  getVideoInputList(): ResultAsync<VideoInput[], Error>;
  onVideoInputListUpdate(cb: (inputs: VideoInput[]) => void): void;
  setVideoInputFile(name: string, path: string): ResultAsync<void, Error>;

  startRecording(): ResultAsync<void, Error>;
  stopRecording(): ResultAsync<void, Error>;
  onRecordingStart(cb: () => void): void;
  onRecordingStop(cb: () => void): void;
  isRecording(): ResultAsync<boolean, Error>;
  getTimestamps(): ResultAsync<{
    recordingTimestamp: Timestamp | null;
    streamTimestamp: Timestamp | null;
  }, Error>;
  getRecordingFolder(): ResultAsync<string, Error>;
  getRecordingFile(): ResultAsync<string | null, Error>;

  saveReplayBuffer(): ResultAsync<string, Error>;

  getCurrentThumbnail(
    dimensions?: { height?: number; width?: number },
  ): ResultAsync<ImageData, Error>;
  getSourceThumbnail(
    sourceName: string,
    dimensions?: { height?: number; width?: number },
  ): ResultAsync<ImageData, Error>;
}
