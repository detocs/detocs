export default interface Person {
  id?: number;
  handle: string;
  prefix: string | null;
  //smashggId: string;
  //twitterHandle: string;
};

export function isEqual(p1: Person, p2: Person): boolean {
  return p1.id === p2.id &&
    p1.handle === p2.handle &&
    p1.prefix === p2.prefix;
}
