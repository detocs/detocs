import parse from 'csv-parse/lib/sync';
import { promises as fs } from 'fs';

import PersonDatabase from '@models/people';
import BracketServiceProvider from '@services/bracket-service-provider';
import { entrantToPerson } from '@util/entrant';
import { getLogger } from '@util/logger';

const logger = getLogger('import-people');

export async function importPeopleDatabase(
  database: PersonDatabase,
  path: string,
): Promise<void> {
  logger.info(`Loading people from ${path}`);
  const csvData = await fs.readFile(path, { encoding: 'utf8' });
  const records: string[][] = parse(csvData);
  const people = records.map(r => ({
    handle: r[0],
    prefix: r[1] || null,
    serviceIds: {
      'twitter': r[2] || undefined,
    },
  }));
  await database.saveAll(people).io;
}

export async function importTournamentEntrants(
  database: PersonDatabase,
  bracketProvider: BracketServiceProvider,
  url: string,
): Promise<void> {
  const parsed = bracketProvider.parse(url);
  if (!parsed) {
    logger.error(`Unable to determine bracket service for URL: ${url}`);
    return;
  }
  const { serviceName, parsedIds } = parsed;
  const bracketService = bracketProvider.get(serviceName);
  logger.info(`Loading people from ${url}`);
  const entrants = await bracketService.entrantsForTournament(parsedIds.tournamentId);
  const people = entrants.map(entrantToPerson.bind(null, database));
  await database.saveAll(people).io;
}
