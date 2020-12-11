import merge from 'lodash.merge';

import { promises as fs, existsSync } from 'fs';
import { dirname } from 'path';

import { getConfig } from '@util/configuration/config';
import { getId } from '@util/id';
import { getLogger } from '@util/logger';
import { getVersion } from '@util/meta';
import { filterValues } from '@util/object';
import { nonNull } from '@util/predicates';

import Person, { isEqual, PersonUpdate, nullPerson, getPrefixedAlias } from './person';

const CURRENT_DB_FORMAT = '2';
const logger = getLogger('people');

interface Database {
  format: string;
  version: string; // App version
  people: Person[];
}

const DEFAULTS = nullPerson;

// TODO: Make PersonDatabase class
const database: Database = {
  format: CURRENT_DB_FORMAT,
  version: getVersion(),
  people: [],
};
let backedUp = false;
const recentPersonUsages = new Map<string, number>();

export async function loadDatabase(): Promise<void> {
  const filePath = getConfig().peopleDatabaseFile;
  let db: Database;
  try {
    db = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
  } catch (error) {
    logger.error(`Unable to load database from ${filePath}: ${error}`);
    return;
  }
  logger.info(`Loading person database from ${filePath}.
format: ${db.format}
version: ${db.version}
person count: ${db.people.length}`);
  upgradeDb(db);
  database.people = db.people.map(parsePerson)
    .filter(nonNull);
  backedUp = false;
}

function upgradeDb(db: Database): Database {
  if (db.format == null) {
    db.format = '1';
  }
  if (isNaN(+db.format) || +db.format > +CURRENT_DB_FORMAT) {
    throw new Error(`Unknown database format: ${db.format}`);
  }
  if (db.format === '1') {
    const targetFormat = '2';
    logger.warn(`Upgrading database from format version ${db.format} to ${targetFormat}`);
    db.people.forEach((person: Person & { twitter?: string; smashggId?: string }) => {
      person.serviceIds = {
        twitter: person.twitter,
        smashgg: person.smashggId,
      };
      delete person.twitter;
      delete person.smashggId;
    });
    db.format = targetFormat;
  }
  if (!(db.format === CURRENT_DB_FORMAT)) {
    throw new Error(`Unable to upgrade database to current format (${CURRENT_DB_FORMAT})`);
  }
  return db;
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
    serviceIds: filterValues(p.serviceIds, value => !!value),
  };
}

export async function saveDatabase(): Promise<void> {
  const filePath = getConfig().peopleDatabaseFile;
  if (!backedUp && existsSync(filePath)) {
    const backupPath = filePath + '.bak';
    logger.info(`Backing-up previous person database to ${backupPath}`);
    await fs.rename(filePath, backupPath);
    backedUp = true;
  }
  logger.debug(`Saving ${database.people.length} person records`);
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(database, null, 2));
}

export function getById(id?: string): Person | null {
  if (id == null || id === '') {
    return null;
  }
  return database.people.find(p => p.id === id) || null;
}

export function getByServiceId(serviceName: string, id: string): Person | null {
  // TODO: Choose latest person if multiple have same ID?
  return database.people.find(p => p.serviceIds[serviceName] === id) || null;
}

export function save(upd: PersonUpdate): Person {
  const existingPerson = getById(upd.id);
  const ret = existingPerson
    ? update(existingPerson, upd)
    : add(upd);
  addRecentPerson(ret);
  return ret;
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
  const updated: Person = merge({}, old, upd);
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

function addRecentPerson(person: Person): void {
  recentPersonUsages.set(person.id, Date.now());
}

export function all(): Person[] {
  return database.people;
}

export function search(query: string): Person[] {
  if (!query) {
    const recents = new Set(recentPersonUsages.keys());
    return database.people.filter(p => recents.has(p.id))
      .sort(sortByRecency);
  }
  query = query.toLowerCase();
  return database.people.filter(p =>
    p.handle.toLowerCase().includes(query) ||
    p.alias?.toLowerCase().includes(query) ||
    p.prefix?.toLowerCase().includes(query)
  )
    .sort(sortByRecency);
}

function sortByRecency(a: Person, b: Person): number {
  const aTime = recentPersonUsages.get(a.id) || 0;
  const bTime = recentPersonUsages.get(b.id) || 0;
  return bTime - aTime;
}

export function findByFullName(query: string): Person[] {
  query = query.toLowerCase();
  return database.people.filter(p => getPrefixedAlias(p).toLowerCase() === query);
}
