import Scoreboard from '../../../models/scoreboard';
import LowerThird from '../../../models/lower-third';

export default interface Output {
  updateScoreboard(scoreboard: Scoreboard): void;
  updateLowerThird(lowerThird: LowerThird): void;
}
