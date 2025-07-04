import { Clip, ImageClip, isImageClip, VideoClip, isVideoClip } from '@models/media';
import { Id } from '@util/id';

export interface State {
  readonly clips: ClipView[];
  readonly scenes: string[];
  readonly visionMixer: {
    readonly name: string|null;
    readonly mediaSources: string[];
  };
}

export const nullState: State = {
  clips: [],
  scenes: [],
  visionMixer: {
    name: null,
    mediaSources: [],
  },
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

export function getClipById(state: State, id: Id|null): ClipView|null {
  return state.clips.find(c => c.clip.id === id) || null;
}
