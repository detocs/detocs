export default interface Game {
  id: string;
  name: string;
  shortNames: string[];
  hashtags: string[];
};

export const nullGame: Game = {
  id: '',
  name: '',
  shortNames: [],
  hashtags: [],
};
