export default interface Game {
  id: string;
  name: string;
  shortNames: string[];
  hashtags: string[];
  additionalTags?: string[];
  serviceInfo: {
    [serviceName: string]: {
      id: string;
    } | undefined;
  };
}

export const nullGame: Game = {
  id: '',
  name: '',
  shortNames: [],
  hashtags: [],
  serviceInfo: {},
};
