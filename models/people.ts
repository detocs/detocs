import log4js from 'log4js';
const logger = log4js.getLogger('people');

import Person from './person';

const people: Person[] = [
  { id: 0, handle: 'Datagram', prefix: 'LP'},
  { id: 1, handle: 'Quick Dwarf', prefix: null},
  { id: 2, handle: 'Nymphs Blitz', prefix: 'VEX JOG'},
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

export function add(person: Person): Person {
  logger.info('New person:', person);
  person.id = nextId++;
  people.push(person);
  logger.debug('People:', people);
  return person;
}

export function update(old: Person, updated: Person): void {
  logger.info('update person:', old, updated);
  for (let p of people) {
    if (p.id === old.id) {
      p = updated;
    }
  }
  logger.debug('People:', people);
}

export function searchByHandle(query: string): Person[] {
  query = query.toLowerCase();
  return people.filter(p => p.handle.toLowerCase().includes(query))
}
