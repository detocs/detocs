import { Clip, ImageClip, isImageClip, VideoClip, isVideoClip } from '@models/media';

export interface State {
  readonly clips: ClipView[];
  readonly scenes: string[],
  readonly mediaSources: string[],
}

export const nullState: State = {
  clips: [],
  scenes: [],
  mediaSources: [],
};

export interface ClipView<T extends Clip = Clip> {
  clip: T;
  status: ClipStatus;
}

export enum ClipStatus {
  Uncut = 'UNCUT',
  Rendering = 'RENDERING',
  Rendered = 'RENDERED',
}

export function isImageClipView(clipView: ClipView): clipView is ClipView<ImageClip> {
  return isImageClip(clipView.clip);
}

export function isVideoClipView(clipView: ClipView): clipView is ClipView<VideoClip> {
  return isVideoClip(clipView.clip);
}
