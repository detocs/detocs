import { Id } from '@util/id';

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
  recordingTimestampMs?: number;
  streamTimestampMs?: number;
}

export interface Replay {
  video: VideoFile;
  waveform: ImageFile;
  thumbnail: ImageFile;
  recordingTimestampMs?: number;
  streamTimestampMs?: number;
}

export interface Clip {
  id: Id;
  media: ImageFile | VideoFile;
  description: string;
  recordingTimestampMs?: number;
  streamTimestampMs?: number;
}

export interface ImageClip extends Clip {
  media: ImageFile;
}

export function isImageClip(clip: Clip): clip is ImageClip {
  return clip.media.type == 'image';
}

export interface VideoClip extends Clip {
  media: VideoFile;
  waveform: ImageFile;
  thumbnail: ImageFile;
  clipStartMs: number;
  clipEndMs: number;
}

export function isVideoClip(clip: Clip): clip is VideoClip {
  return clip.media.type == 'video';
}
