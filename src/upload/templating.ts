import { Error } from 'chainable-error';
import { promises as fs } from 'fs';
import Handlebars from 'handlebars';
import moment from 'moment-timezone';

import { getLogger } from '@util/logger';
import { nonEmpty } from '@util/predicates';

import { VodTournament, VodVideogame, VodPhase } from './types';
import { getConfig } from '@util/configuration/config';

// TODO: Make description configurable
interface TemplateData {
  'description': string;
  'tournamentName': string;
  'tournamentVenue': string;
  'tournamentUrl': string;
  'date': string;
  'hashtags': string;
}
type VodTemplate = (data: TemplateData) => string;

const DEFAULT_PER_SET_TEMPLATE = `{{description}}

{{tournamentName}}
{{date}}
{{tournamentVenue}}
{{tournamentUrl}}

{{hashtags}}`;
const DEFAULT_SINGLE_VIDEO_TEMPLATE = '0:00:00 - Intro\n' + DEFAULT_PER_SET_TEMPLATE;
const TEST_DATA: TemplateData = {
  'description': 'multi\nline\ndescription',
  'tournamentName': 'Test Tournament',
  'tournamentVenue': 'Venue - City, State',
  'tournamentUrl': 'https://tournaments.com/test-tournament',
  'date': 'October 10th, 2020',
  'hashtags': '#DETOCS #test',
};

const logger = getLogger('upload/templating');
const hb = Handlebars.create();

export function videoDescription(
  template: VodTemplate,
  tournament: VodTournament,
  videogame: VodVideogame,
  phase: VodPhase,
  matchDesc: string): string {
  const date = formatDate(
    phase.startAt != null ? phase.startAt : tournament.startAt,
    phase.startAt != null ? null : tournament.endAt,
    tournament.timezone);

  const hashtags = [
    tournament.hashtag,
    videogame.hashtag,
  ];

  const templateData = {
    'description': matchDesc,
    'tournamentName': tournament.name,
    'tournamentVenue': [tournament.venueName, tournament.venueAddress].filter(nonEmpty).join(' - '),
    'tournamentUrl': tournament.url,
    'date': date,
    'hashtags': hashtags.filter(nonEmpty).map(str => "#" + str).join(' '),
  };
  return template(templateData);
}

export async function getSingleVideoTemplate(): Promise<VodTemplate> {
  return getTemplate(DEFAULT_SINGLE_VIDEO_TEMPLATE, getConfig().vodSingleVideoTemplate);
}

export async function getPerSetTemplate(): Promise<VodTemplate> {
  return getTemplate(DEFAULT_PER_SET_TEMPLATE, getConfig().vodPerSetTemplate);
}

async function getTemplate(
  fallback: string,
  file?: string,
): Promise<VodTemplate>  {
  if (file) {
    try {
      const templateStr = await fs.readFile(file, { encoding: 'utf8' });
      const renderTemplate = hb.compile<TemplateData>(templateStr, { noEscape: true });
      renderTemplate(TEST_DATA);
      return renderTemplate;
    } catch (e) {
      logger.error(new Error('Template unable to render sample output', e));
    }
  }
  return hb.compile<TemplateData>(fallback, { noEscape: true });
}

function formatDate(start?: number | null, end?: number | null, timezone?: string | null): string {
  const format = (n: number): string => timezone ?
    moment.unix(n).tz(timezone).format('LL') :
    moment.unix(n).format('LL');

  if (start == null) {
    return '';
  }

  if (end == null) {
    return format(start);
  }

  return `${format(start)} – ${format(end)}`;
}
