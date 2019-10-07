import State from '../state';

export default interface Output {
  // TODO: Single update method?
  updateScoreboard(state: State): void;
  updateLowerThird(state: State): void;
  updateBreak(state: State): void;
}
