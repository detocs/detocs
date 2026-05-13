export default interface GameCharacter {
  id: string;
  options?: {
    [configId: string]: string;
  };
}

export const nullGameCharacter: GameCharacter = Object.freeze({
  id: '',
});
