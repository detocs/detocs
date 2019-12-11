import log4js from 'log4js';
const logger = log4js.getLogger('export-people');

import { writeFile } from "fs";
import Handlebars from 'handlebars';
import { promisify } from "util";

import { all, loadDatabase } from "../models/people";
import { escapeCsv, escapeDoublePipe } from "../util/escaping";

import ExportFormat from "./export-format";

const asyncWriteFile = promisify(writeFile);

export default async function exportPeopleDatabase(
  format: ExportFormat,
  path: string
): Promise<void> {
  loadDatabase();
  logger.info(`Saving people database to ${path}`);
  Handlebars.registerHelper('escapeCsv', escapeCsv);
  Handlebars.registerHelper('escapeDoublePipe', escapeDoublePipe);
  const template = Handlebars.compile(format, { noEscape: true });
  const output = template(all());
  await asyncWriteFile(path, output, 'utf8');
}
