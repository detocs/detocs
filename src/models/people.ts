import { promises as fs, existsSync } from 'fs';
import merge from 'lodash.merge';
import { dirname } from 'path';

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

interface DatabaseUpdateResult {
  person: Person;
  databaseUpdated: boolean;
}

const DEFAULTS = nullPerson;

export default class PersonDatabase {
  private readonly database: Database = {
    format: CURRENT_DB_FORMAT,
    version: getVersion(),
    people: [],
  };
  private readonly recentPersonUsages = new Map<string, number>();
  private readonly filePath: string;
  private backedUp = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  public async loadDatabase(): Promise<void> {
    let db: Database;
    try {
      db = JSON.parse(await fs.readFile(this.filePath, { encoding: 'utf8' }));
    } catch (error) {
      logger.warn(`Unable to load database from ${this.filePath}: ${error}`);
      return;
    }
    logger.info(`Loading person database from ${this.filePath}.
  format: ${db.format}
  version: ${db.version}
  person count: ${db.people.length}`);
    upgradeDb(db);
    this.database.people = db.people.map(parsePerson)
      .filter(nonNull);
    this.backedUp = false;
  }

  public async saveDatabase(): Promise<void> {
    if (!this.backedUp && existsSync(this.filePath)) {
      const backupPath = this.filePath + '.bak';
      logger.info(`Backing-up previous person database to ${backupPath}`);
      await fs.rename(this.filePath, backupPath);
      this.backedUp = true;
    }
    logger.debug(`Saving ${this.database.people.length} person records`);
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.database, null, 2));
  }

  public getById(id?: string): Person | null {
    if (id == null || id === '') {
      return null;
    }
    return this.database.people.find(p => p.id === id) || null;
  }

  public getByServiceId(serviceName: string, id: string): Person | null {
    // TODO: Choose latest person if multiple have same ID?
    return this.database.people.find(p => p.serviceIds[serviceName] === id) || null;
  }

  // TODO: This interface is kinda...
  public save(update: PersonUpdate): { person: Person, io: Promise<void> | null } {
    const { person, databaseUpdated } = this.saveInternal(update);
    let io = null;
    if (databaseUpdated) {
      io = this.saveDatabase()
        .catch(logger.error);
    }
    return { person, io };
  }

  public saveAll(updates: PersonUpdate[]): { people: Person[], io: Promise<void> | null } {
    const results = updates.map(this.saveInternal);
    const people = results.map(result => result.person);
    const shouldSave = results.some(result => result.databaseUpdated);
    let io = null;
    if (shouldSave) {
      io = this.saveDatabase()
        .catch(logger.error);
    }
    return { people, io };
  }

  saveInternal: (upd: PersonUpdate) => DatabaseUpdateResult = upd => {
    const existingPerson = this.getById(upd.id);
    const ret = existingPerson
      ? this.update(existingPerson, upd)
      : this.add(upd);
    this.addRecentPerson(ret.person);
    return ret;
  };

  add(update: PersonUpdate): DatabaseUpdateResult {
    const person: Person = Object.assign({}, DEFAULTS, update);
    if (!person.handle) {
      return { person, databaseUpdated: false };
    }

    logger.info('New person:', update);
    person.id = getId();
    this.database.people.push(person);
    logger.debug('People:', this.database.people.slice(-4));
    return { person, databaseUpdated: true };
  }

  update(old: Person, upd: PersonUpdate): DatabaseUpdateResult {
    const updated: Person = merge({}, old, upd);
    const i = this.database.people.findIndex(p => p.id === old.id);
    if (i == -1) {
      // This shouldn't really happen
      return { person: updated, databaseUpdated: false };
    }
    if (isEqual(this.database.people[i], updated)) {
      return { person: updated, databaseUpdated: false };
    }
    logger.info('update person:', this.database.people[i], updated);
    this.database.people[i] = updated;
    logger.debug('People:', this.database.people.slice(Math.max(0, i - 2), i + 2));
    return { person: updated, databaseUpdated: true };
  }

  public all(): Person[] {
    return this.database.people;
  }

  public search(query: string): Person[] {
    if (!query) {
      const recents = new Set(this.recentPersonUsages.keys());
      return this.database.people.filter(p => recents.has(p.id))
        .sort(this.sortByRecency);
    }
    query = query.toLowerCase();
    return this.database.people.filter(p =>
      p.handle.toLowerCase().includes(query) ||
      p.alias?.toLowerCase().includes(query) ||
      p.prefix?.toLowerCase().includes(query)
    )
      .sort(this.sortByRecency);
  }

  public findByFullName(query: string): Person[] {
    query = query.toLowerCase();
    return this.database.people.filter(p => getPrefixedAlias(p).toLowerCase() === query);
  }

  addRecentPerson(person: Person): void {
    this.recentPersonUsages.set(person.id, Date.now());
  }

  sortByRecency: (a: Person, b: Person) => number = (a, b) => {
    const aTime = this.recentPersonUsages.get(a.id) || 0;
    const bTime = this.recentPersonUsages.get(b.id) || 0;
    return bTime - aTime;
  };
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
