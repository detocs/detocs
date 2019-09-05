export default interface Game {
  id: string;
  name: string;
  shortNames: string[];
  hashtags: string[];
  serviceInfo: {
    twitch?: {
      id: string;
    };
    smashgg?: {
      id: number;
    };
  };
};

export const nullGame: Game = {
  id: '',
  name: '',
  shortNames: [],
  hashtags: [],
  serviceInfo: {},
};
