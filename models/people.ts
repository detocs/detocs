import log4js from 'log4js';
const logger = log4js.getLogger('people');

import Person, { isEqual, PersonUpdate } from './person';
import { getVersion } from '../util/meta';
import { readFileSync, renameSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// TODO: Proper serialization
interface Database {
  version: string;
  people: Person[];
}

const DEFAULTS: Person = { id: -1, handle: '', prefix: null, twitter: null};
const DEFAULT_DATABASE_PATH = './database/people.json';

// TODO: Make PersonDatabase class
const database: Database = {
  version: getVersion(),
  people: [],
};
let nextId = getNextId(database.people);
let filePath = DEFAULT_DATABASE_PATH;
let backedUp = true;

export function loadDatabase(path: string = DEFAULT_DATABASE_PATH): void {
  let db: Database;
  try {
    db = JSON.parse(readFileSync(path).toString());
  } catch (error) {
    logger.warn(`Unable to load database from ${path}: ${error}`);
    return;
  }
  logger.info(`Loading person database from ${path}.
version: ${db.version}
person count: ${db.people.length}`);
  database.people = db.people;
  nextId = getNextId(database.people);
  filePath = path;
  backedUp = false;
}

async function saveDatabase(): Promise<void> {
  if (!backedUp) {
    logger.info(`Backing-up previous person database to ${filePath}`);
    renameSync(filePath, filePath + '.bak');
    backedUp = true;
  }
  logger.debug(`Saving ${database.people.length} person records`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(database, null, 2));
}

function getNextId(people: Person[]): number {
  const maxId = people.map(p => p.id)
    .reduce((prev, cur) => prev > cur ? prev : cur, -1);
  return maxId + 1;
}

export function getById(id?: number): Person | null {
  if (id == null) {
    return null;
  }
  return database.people.find(p => p.id === id) || null;
}

export function save(upd: PersonUpdate): Person {
  let existingPerson = getById(upd.id);
  if (existingPerson) {
    return update(existingPerson, upd);
  } else {
    return add(upd);
  }
}

function add(update: PersonUpdate): Person {
  const person: Person = Object.assign({}, DEFAULTS, update);
  if (!person.handle) {
    return person;
  }

  logger.info('New person:', update);
  person.id = nextId++;
  database.people.push(person);
  saveDatabase();
  logger.debug('People:', database.people.slice(-10));
  return person;
}

function update(old: Person, upd: PersonUpdate): Person {
  const updated: Person = Object.assign({}, old, upd);
  database.people.forEach((p, i) => {
    if (p.id === old.id && !isEqual(p, updated)) {
      logger.info('update person:', old, updated);
      database.people[i] = updated;
      saveDatabase();
      logger.debug('People:', database.people.slice(Math.max(0, i - 5), i + 5));
    }
  });
  return updated;
}

export function searchByHandle(query: string): Person[] {
  query = query.toLowerCase();
  return database.people.filter(p => p.handle.toLowerCase().includes(query));
}
