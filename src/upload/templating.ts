import { Error } from 'chainable-error';
import { promises as fs } from 'fs';
import Handlebars from 'handlebars';
import moment from 'moment-timezone';

import { nonEmpty } from '@util/predicates';

import { VodTournament, VodVideogame, VodPhase, VodUserData, Set } from './types';
import { getConfig } from '@util/configuration/config';
import { handleBuiltin } from '@util/path';

export interface RawTemplateData {
  tournament: VodTournament,
  event: string | null;
  videogame: VodVideogame,
  phase: VodPhase,
  matchDesc: string,
  commentary: string,
  userData?: VodUserData,
  set?: Set & {
    userData?: VodUserData;
  }
}

// TODO: Make description configurable
interface TemplateData {
  description: string;
  tournament: VodTournament;
  tournamentName: string;
  tournamentVenue: string;
  tournamentUrl?: string;
  eventName?: string;
  phase: VodPhase;
  date: string;
  videogame: VodVideogame;
  hashtags: string;
  commentary: string;
  commentators: string; // backwards-compatibility
  userData: VodUserData;
  set?: Set & {
    userData: VodUserData;
  }
}
type VodTemplate = (data: TemplateData) => string;

// Visible for testing
export const TEST_DATA: TemplateData = {
  description: 'multi\nline\ndescription',
  tournament: {
    name: 'Test Tournament',
    shortName: 'Test',
    hashtag: 'DETOCS',
    additionalTags: ['additional_tag'],
    url: 'https://tournaments.com/test-tournament',
    venueName: 'Venue',
    venueAddress: 'City, State',
    timezone: 'America/New_York',
    startAt: 1711141200,
    endAt: 1711335600,
  },
  tournamentName: 'Test Tournament',
  tournamentVenue: 'Venue - City, State',
  tournamentUrl: 'https://tournaments.com/test-tournament',
  phase: {
    name: 'Top 8',
  },
  date: 'October 10th, 2020',
  videogame: {
    id: 'tv',
    name: 'Test Videogame',
    shortNames: ['Test VG'],
    shortName: 'Test VG',
    hashtags: ['test'],
    hashtag: 'test',
    serviceInfo: {},
  },
  hashtags: '#DETOCS #test #additional_tag',
  commentary: 'Test Commentator',
  commentators: 'Test Commentator',
  userData: {},
  set: {
    id: '12345678',
    phaseGroupId: '234567',
    players: [
      {
        handle: 'Player 1',
        prefix: 'ABC',
        alias: 'Player Uno',
        name: 'ABC | Player 1',
        characters: [
          {
            name: 'Character 1',
          },
          {
            name: 'Character 2',
          },
        ],
      },
      {
        handle: 'Player 2',
        prefix: null,
        alias: null,
        name: 'Player 2',
      },
    ],
    start: '00:12:34',
    end: '00:23:45',
    fullRoundText: 'Winners Quarter-Final',
    userData: {},
  },
};

const hb = Handlebars.create();

export function renderVodTemplate(
  template: VodTemplate,
  {
    tournament,
    event,
    videogame,
    phase,
    matchDesc,
    commentary,
    userData,
    set,
  }: RawTemplateData,
): string {
  const date = formatDate(
    phase.startAt != null ? phase.startAt : tournament.startAt,
    phase.startAt != null ? null : tournament.endAt,
    tournament.timezone);

  const hashtags = [
    tournament.hashtag,
    videogame.hashtag,
  ];

  const templateData: TemplateData = {
    description: matchDesc,
    tournament,
    tournamentName: tournament.name,
    tournamentVenue: [tournament.venueName, tournament.venueAddress].filter(nonEmpty).join(' - '),
    tournamentUrl: tournament.url,
    eventName: event || undefined,
    videogame,
    phase,
    date,
    hashtags: hashtags.filter(nonEmpty).map(str => "#" + str).join(' '),
    commentary,
    commentators: commentary,
    userData: userData || {},
    set: set && {
      userData: {},
      ...set,
    },
  };
  return template(templateData);
}

export async function getSingleVideoTemplate(): Promise<VodTemplate> {
  return getTemplate(handleBuiltin('templates/vod', getConfig().templates.vod.singleVideo.description));
}

export async function getSingleVideoTitleTemplate(): Promise<VodTemplate> {
  return getTemplate(handleBuiltin('templates/vod', getConfig().templates.vod.singleVideo.title));
}

export async function getPerSetTemplate(): Promise<VodTemplate> {
  return getTemplate(handleBuiltin('templates/vod', getConfig().templates.vod.perSet.description));
}

export async function getPerSetTitleTemplate(): Promise<VodTemplate> {
  return getTemplate(handleBuiltin('templates/vod', getConfig().templates.vod.perSet.title));
}

async function getTemplate(file: string): Promise<VodTemplate>  {
  try {
    const templateStr = await fs.readFile(file, { encoding: 'utf8' });
    const renderTemplate = hb.compile<TemplateData>(templateStr, { noEscape: true });
    renderTemplate(TEST_DATA);
    return renderTemplate;
  } catch (e) {
    throw new Error('Template unable to render sample output', e as Error);
  }
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

  const startDate = format(start);
  // Consider end times between 12am and 6am to correspond to the previous day.
  const adjustedEnd = Math.max(end - 6 * 3600, start);
  const endDate = format(adjustedEnd);

  if (startDate == endDate) {
    return startDate;
  }

  return `${startDate} – ${endDate}`;
}
