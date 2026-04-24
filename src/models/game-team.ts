import GameCharacter from '@models/game-character.ts';

export default interface GameTeam {
  characters: GameCharacter[];
  options?: {
    [configId: string]: string;
  };
}

export const nullGameTeam: GameTeam = {
  characters: [],
  options: {},
};
