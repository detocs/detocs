import log4js from 'log4js';
const logger = log4js.getLogger('people');

import Person, { isEqual, PersonUpdate } from './person';
import { getVersion } from '../util/meta';
import { readFileSync, renameSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { getConfig } from '../util/config';

// TODO: Proper serialization
interface Database {
  version: string;
  people: Person[];
}

const DEFAULTS: Person = { id: -1, handle: '', prefix: null, twitter: null};
const DATABASE_FILE = 'people.json';

// TODO: Make PersonDatabase class
const database: Database = {
  version: getVersion(),
  people: [],
};
let nextId = getNextId(database.people);
let backedUp = false;

export function loadDatabase(): void {
  const filePath = join(getConfig().databaseDirectory, DATABASE_FILE);
  let db: Database;
  try {
    db = JSON.parse(readFileSync(filePath).toString());
  } catch (error) {
    logger.warn(`Unable to load database from ${filePath}: ${error}`);
    return;
  }
  logger.info(`Loading person database from ${filePath}.
version: ${db.version}
person count: ${db.people.length}`);
  database.people = db.people.map(parsePerson);
  nextId = getNextId(database.people);
  backedUp = false;
}

function parsePerson(p: Person): Person {
  return {
    id: p['id'],
    handle: p['handle'],
    prefix: p['prefix'],
    twitter: p['twitter'],
  };
}

async function saveDatabase(): Promise<void> {
  const filePath = join(getConfig().databaseDirectory, DATABASE_FILE);
  if (!backedUp && existsSync(filePath)) {
    const backupPath = filePath + '.bak';
    logger.info(`Backing-up previous person database to ${backupPath}`);
    renameSync(filePath, backupPath);
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
