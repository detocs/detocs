import { Clip } from '../../models/media';

export interface State {
  readonly clips: Clip[];
};

export const nullState: State = {
  clips: [],
};
