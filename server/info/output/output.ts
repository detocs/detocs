import State from '@server/info/state';

export default interface Output {
  init(): Promise<void>;
  update(state: State): void;
}
