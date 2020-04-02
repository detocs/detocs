export interface MediaFile {
  url: string;
  type: string;
}

export type ImageFile = MediaFile & {
  type: 'image';
  height: number;
};

export type VideoFile = MediaFile & {
  type: 'video';
};

export interface Screenshot {
  image: ImageFile;
  timestampMillis?: number;
}

export interface Replay {
  video: VideoFile;
  startMillis?: number;
  endMillis?: number;
}
