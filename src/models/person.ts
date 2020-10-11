import _isEqual from 'lodash.isequal';

export default interface Person {
  id: string;
  handle: string;
  alias?: string;
  prefix: string | null;
  serviceIds: {
    [serviceName: string]: string | undefined;
  }
}

export type PersonUpdate = Partial<Person>;

export const nullPerson: Person = Object.freeze({
  id: '',
  handle: '',
  prefix: null,
  serviceIds: {},
});

export function isEqual(p1: Person, p2: Person): boolean {
  return _isEqual(p1, p2);
}

export function getPrefixedName(p: Person | PersonUpdate): string {
  const prefix = p.prefix ? `${p.prefix} | ` : '';
  return `${prefix}${p.handle}`;
}

export function getPrefixedAlias(p: Person | PersonUpdate): string {
  const prefix = p.prefix ? `${p.prefix} | ` : '';
  return `${prefix}${p.alias || p.handle}`;
}

export function getPrefixedNameWithAlias(p: Person | PersonUpdate): string {
  const prefix = p.prefix ? `${p.prefix} | ` : '';
  const suffix = p.alias ? ` (${p.handle})` : '';
  return `${prefix}${p.alias || p.handle}${suffix}`;
}

export function getNameWithAlias(p: Person | PersonUpdate): string {
  const suffix = p.alias ? ` (${p.handle})` : '';
  return `${p.alias || p.handle}${suffix}`;
}
