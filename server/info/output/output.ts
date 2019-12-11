import State from '../state';

export default interface Output {
  init(): Promise<void>;
  update(state: State): void;
}
