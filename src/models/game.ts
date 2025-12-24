export default interface Game {
  readonly id: string;
  readonly name: string;
  readonly shortNames: string[];
  readonly hashtags: string[];
  readonly additionalTags?: string[];
  readonly serviceInfo: {
    [serviceName: string]: {
      id: string;
    } | undefined;
  };
  readonly characters?: GameOption[];
  readonly characterConfigs?: GameConfig[];
  readonly teamConfigs?: GameConfig[];
  readonly teamSize?: number;
}

export interface GameConfig {
  readonly id: string;
  readonly name: string;
  readonly options: GameOption[];
}

export interface GameOption {
  readonly id: string;
  readonly name: string;
  readonly shortNames?: string[];
}

export const nullGame: Game = {
  id: '',
  name: '',
  shortNames: [],
  hashtags: [],
  serviceInfo: {},
};
