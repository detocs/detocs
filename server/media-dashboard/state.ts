import { Clip } from '../../models/media';

export interface State {
  readonly clips: ClipView[];
};

export const nullState: State = {
  clips: [],
};

export interface ClipView {
  clip: Clip;
  status: ClipStatus;
}

export enum ClipStatus {
  Uncut = 'UNCUT',
  Rendering = 'RENDERING',
  Rendered = 'RENDERED',
}
