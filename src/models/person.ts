export default interface Person {
  id: string;
  handle: string;
  prefix: string | null;
  twitter?: string;
  smashggId?: string;
};

export type PersonUpdate = Partial<Person>;

export const nullPerson: Person = Object.freeze({
  id: '',
  handle: '',
  prefix: null,
});

export function isEqual(p1: Person, p2: Person): boolean {
  return p1.id === p2.id &&
    p1.handle === p2.handle &&
    p1.prefix === p2.prefix &&
    p1.twitter === p2.twitter &&
    p1.smashggId === p2.smashggId;
}

export function getName(p: Person | PersonUpdate): string {
  const prefix = p.prefix ? `${p.prefix} | ` : '';
  return `${prefix}${p.handle}`;
}
