import Match from '../../../models/match';

export default interface Output {
  match(match: Match): void;
}