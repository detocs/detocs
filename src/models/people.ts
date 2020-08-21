import { getLogger } from '@util/logger';

import { readFileSync, renameSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

import { getConfig } from '@util/configuration/config';
import { getVersion } from '@util/meta';
import { nonNull } from '@util/predicates';

import Person, { isEqual, PersonUpdate, nullPerson, getName } from './person';
import { getId } from '@util/id';

const CURRENT_DB_FORMAT = "1";
const logger = getLogger('people');

interface Database {
  format: string;
  version: string; // App version
  people: Person[];
}

interface LoadedDatabase extends Omit<Database, 'people'> {
  people: Partial<Person>[];
}

const DEFAULTS = nullPerson;

// TODO: Make PersonDatabase class
const database: Database = {
  format: CURRENT_DB_FORMAT,
  version: getVersion(),
  people: [],
};
let backedUp = false;

export function loadDatabase(): void {
  const filePath = getConfig().peopleDatabaseFile;
  let db: Database;
  try {
    db = JSON.parse(readFileSync(filePath).toString());
  } catch (error) {
    logger.warn(`Unable to load database from ${filePath}: ${error}`);
    return;
  }
  logger.info(`Loading person database from ${filePath}.
format: ${db.format}
version: ${db.version}
person count: ${db.people.length}`);
  database.people = db.people.map(parsePerson)
    .filter(nonNull);
  backedUp = false;
}

function parsePerson(p: Partial<Person>): Person | null {
  const handle = p.handle;
  if (!handle) {
    logger.warn('`handle` field is required. Skipping person record.');
    return null;
  }
  let id = p.id;
  if (typeof id !== 'string' || id === '') {
    logger.info(`Valid ID not found for ${handle}. Generating new ID.`);
    id = getId();
  }
  return {
    ...p,
    id,
    handle,
    prefix: p.prefix || null,
    twitter: p.twitter || undefined,
  };
}

export async function saveDatabase(): Promise<void> {
  const filePath = getConfig().peopleDatabaseFile;
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

export function getById(id?: string): Person | null {
  if (id == null || id === '') {
    return null;
  }
  return database.people.find(p => p.id === id) || null;
}

export function getBySmashggId(id: string): Person | null {
  // TODO: Choose latest person if multiple have same ID?
  return database.people.find(p => p.smashggId === id) || null;
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
  person.id = getId();
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

export function all(): Person[] {
  return database.people;
}

export function searchByHandle(query: string): Person[] {
  query = query.toLowerCase();
  return database.people.filter(p => p.handle.toLowerCase().includes(query));
}

export function findByFullName(query: string): Person[] {
  query = query.toLowerCase();
  return database.people.filter(p => getName(p).toLowerCase() === query);
}
