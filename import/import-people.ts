import log4js from 'log4js';
const logger = log4js.getLogger('export-people');

import parse from 'csv-parse/lib/sync';
import { promises as fs } from 'fs';

import { loadDatabase, save, saveDatabase } from '../models/people';
import { PersonUpdate } from '../models/person';

export default async function importPeopleDatabase(path: string): Promise<void> {
  loadDatabase();
  logger.info(`Loading people from ${path}`);
  const csvData = await fs.readFile(path, { encoding: 'utf8' });
  const records: string[][] = parse(csvData);
  for (const r of records) {
    const p: PersonUpdate = {
      handle: r[0],
      prefix: r[1] || null,
      twitter: r[2] || null,
    };
    save(p);
  }
  await saveDatabase();
}
