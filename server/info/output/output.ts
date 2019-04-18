import Scoreboard from '../../../models/scoreboard';

export default interface Output {
  update(match: Scoreboard): void;
}
