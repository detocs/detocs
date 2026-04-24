import { writeFile } from 'fs';
import Handlebars from 'handlebars';
import { promisify } from 'util';

import PersonDatabase from '@models/people.ts';
import { escapeCsv, escapeDoublePipe } from '@util/escaping.ts';
import { getLogger } from '@util/logger.ts';

import ExportFormat from './export-format.ts';

const logger = getLogger('export-people');
const asyncWriteFile = promisify(writeFile);

export default async function exportPeopleDatabase(
  database: PersonDatabase,
  format: ExportFormat,
  path: string
): Promise<void> {
  logger.info(`Saving people database to ${path}`);
  Handlebars.registerHelper('escapeCsv', escapeCsv);
  Handlebars.registerHelper('escapeDoublePipe', escapeDoublePipe);
  const template = Handlebars.compile(format, { noEscape: true });
  const output = template(database.all());
  await asyncWriteFile(path, output, 'utf8');
}
