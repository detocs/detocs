import log4js from 'log4js';
const logger = log4js.getLogger('people');

import Person, { isEqual, PersonUpdate } from './person';

const DEFAULTS: Person = { id: -1, handle: '', prefix: null, twitter: null}

const people: Person[] = [
  { id: 0, handle: 'Datagram', prefix: 'LP', twitter: 'gramofdata'},
  { id: 1, handle: 'Quick Dwarf', prefix: null, twitter: 'QuickDwarf'},
  { id: 2, handle: 'Nymphs Blitz', prefix: 'VEX JOG', twitter: 'VJ_NymphsBlitz'},
];
let nextId = people.length;

export function list(): Person[] {
  return people;
}

export function getById(id?: number): Person | null {
  if (id == null) {
    return null;
  }
  return people.find(p => p.id === id) || null;
}

export function save(upd: PersonUpdate): Person {
  let existingPerson = getById(upd.id);
  if (existingPerson) {
    return update(existingPerson, upd);
  } else {
    return add(upd);
  }
}

export function add(update: PersonUpdate): Person {
  const person: Person = Object.assign({}, DEFAULTS, update);
  if (!person.handle) {
    return person;
  }

  logger.info('New person:', update);
  person.id = nextId++;
  people.push(person);
  logger.debug('People:', people);
  return person;
}

export function update(old: Person, upd: PersonUpdate): Person {
  const updated: Person = Object.assign({}, old, upd);
  people.forEach((p, i) => {
    if (p.id === old.id && !isEqual(p, updated)) {
      logger.info('update person:', old, updated);
      people[i] = updated;
      logger.debug('People:', people);
    }
  });
  return updated;
}

export function searchByHandle(query: string): Person[] {
  query = query.toLowerCase();
  return people.filter(p => p.handle.toLowerCase().includes(query))
}
