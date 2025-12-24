export default interface GameCharacter {
  id: string;
  options?: {
    [configId: string]: string;
  };
}
