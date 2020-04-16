export interface MediaFile {
  filename: string;
  url: string;
  type: string;
}

export type ImageFile = MediaFile & {
  type: 'image';
  height: number;
};

export type VideoFile = MediaFile & {
  type: 'video';
  durationMs: number;
};

export interface Screenshot {
  image: ImageFile;
  timestampMs?: number;
}

export interface Replay {
  video: VideoFile;
  waveform: ImageFile;
  startMs?: number;
  endMs?: number;
}

export interface Clip {
  id: string;
  video: VideoFile;
  waveform: ImageFile;
  description?: string;
  clipStartMs: number;
  clipEndMs: number;
  recordingTimestampMs?: number;
  streamTimestampMs?: number;
}
