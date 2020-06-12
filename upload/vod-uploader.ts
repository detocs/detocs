import childProcess from 'child_process';
import filenamify from 'filenamify';
import fsSync, { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { youtube_v3 as youtubeV3 } from 'googleapis';
import { GraphQLClient } from 'graphql-request';
import yaml from 'js-yaml';
import merge from 'lodash.merge';
import moment from 'moment-timezone';
import ResumableUpload from 'node-youtube-resumable-upload';
import path from 'path';
import util from 'util';

import { SmashggId } from '@models/smashgg';
import { Timestamp } from '@models/timestamp';
import { Log as RecordingLog } from '@server/recording/log';
import SmashggClient from '@services/smashgg';
import {
  getYoutubeAuthClient,
  tagsSize,
  MAX_TAGS_SIZE,
  descriptionSize,
  MAX_DESCRIPTION_SIZE,
  titleSize,
  MAX_TITLE_SIZE
} from '@services/youtube';
import { getLogger } from '@util/logger';

import {
  EVENT_QUERY,
  PHASE_QUERY,
  PHASE_SET_QUERY,
  PHASE_GROUP_SET_QUERY,
  SET_QUERY,
  EventQueryResponse,
  PhaseGroupSetQueryResponse,
  PhaseQueryResponse,
  SetQueryResponse,
  PhaseSetQueryResponse
} from './queries';

const logger = getLogger('upload');

type QueryEvent = EventQueryResponse['event'];
type QueryTournament = QueryEvent['tournament'];
type QueryVideogame = QueryEvent['videogame'];
type QuerySet = SetQueryResponse['set'];

type Tournament = QueryTournament & {
  shortName: string;
  additionalTags: string[];
};

type Videogame = QueryVideogame & {
  hashtag: string;
  shortName: string;
  additionalTags: string[];
};

type Phase = PhaseQueryResponse['phase'];

interface Set {
  id: string | number;
  players: {
    name: string;
    prefix: string | null;
    handle: string;
  }[];
  fullRoundText: string;
  start: Timestamp;
  end: Timestamp;
}

type Log = RecordingLog & {
  title?: string;
  phaseName?: string;
  event?: Partial<{
    tournament: Partial<Tournament>;
    videogame: Partial<Videogame>;
  }>;
  keyframeInterval?: number;
  additionalTags: string[];
  excludedTags?: string[];
};
type SetPhaseGroupMapping = Record<SmashggId, string>;

interface Metadata {
  sourcePath: string;
  start: Timestamp;
  end: Timestamp;
  filename: string;
  title: string;
  description: string;
  tags: string[];
}

export enum Command {
  Metadata,
  Video,
  Upload,
}

export enum Style {
  Full,
  PerSet,
}

interface VodUploaderParams {
  logFile: string;
  command: Command;
  style: Style;
}

const GAMING_CATEGORY_ID = '20';
const pExecFile = util.promisify(childProcess.execFile);
const nonEmpty = (str: string | null): str is string => !!str;
let keyframeInterval = 3;

// TODO: Integrate with game DB
const gameHashtags: Record<number, string> = {
  7: 'SFV',
  17: 'Tekken7',
  18: 'UMvC3',
  32: 'Skullgirls',
  37: 'BBCF',
  38: 'KOFXIV',
  287: 'DBFZ',
  451: 'UNIst',
  904: 'SCVI',
  1144: 'BBTag',
  2366: 'FEXL',
  3200: 'MK11',
  3568: 'SamSho',
  3958: 'MBAACC',
  3960: 'GGXXACPR',
  3961: 'DFCI',
  3969: 'SSVSP',
  4267: 'DFCI',
  4315: 'Yatagarasu',
  9690: 'KOFXIII',
  16391: 'SSVSP',
  17413: 'KOF98UMFE',
  22107: 'GBVS',
  22407: 'MBAACC',
  33870: 'UNIclr',
};

const nameOverrides: Record<number, string> = {
  451: 'Under Night In-Birth Exe:Late[st]',
  3969: 'Samurai Shodown V Special',
  16391: 'Samurai Shodown V Special',
  17413: 'The King of Fighters \'98: Ultimate Match Final Edition',
};

const additionalTags: Record<number, string[]> = {
  38: ['King of Fighters XIV', 'King of Fighters 14', 'King of Fighters', 'KOF14'],
  451: ['Under Night In-Birth', 'Under Night'],
  3958: ['Melty Blood', 'Melty'],
  17413: ['KOF98', 'KOF98UM'],
  22107: ['Granblue Fantasy', 'Granblue', 'GBFV'],
  22407: ['Melty Blood', 'Melty'],
  33870: ['Under Night In-Birth', 'Under Night'],
};

export class VodUploader {
  private logFile: string;
  private dirName: string;
  private command: Command;
  private style: Style;

  public constructor({ logFile, command, style }: VodUploaderParams) {
    this.logFile = logFile;
    this.dirName = path.join(
      path.dirname(logFile),
      path.basename(logFile, path.extname(logFile))
    );
    this.command = command;
    this.style = style;
  }

  public async run(): Promise<void> {
    let youtubeOauthClient: OAuth2Client | null = null;
    if (this.command == Command.Upload) {
      // Get YouTube credentials first, so that the rest can be done unattended
      youtubeOauthClient = await getYoutubeAuthClient();
    }

    await fs.mkdir(this.dirName, { recursive: true });
    const graphqlClient = new SmashggClient().getClient();
    const setList: Log = JSON.parse(await fs.readFile(this.logFile, { encoding: 'utf8' }));
    const { tournament, videogame, phase } = await getEventInfo(graphqlClient, setList);
    const setToPhaseGroupId = await getPhaseGroupMapping(graphqlClient, setList.phaseId);
    keyframeInterval = setList.keyframeInterval || keyframeInterval;

    let metadata: Metadata[] = [];
    if (this.command >= Command.Metadata) {
      if (this.style === Style.PerSet) {
        metadata = await this.writePerSetMetadata(
          graphqlClient,
          setList,
          tournament,
          videogame,
          phase,
          setToPhaseGroupId,
        );
      } else {
        metadata = [await this.writeSingleVideoMetadata(
          graphqlClient,
          setList,
          tournament,
          videogame,
          phase,
          setToPhaseGroupId,
        )];
      }
    }

    for (const m of metadata) {
      dumpMetadata(m);
    }

    if (this.command >= Command.Video) {
      for (const m of metadata) {
        // Don't bother parallelizing, since reading from the source file is the bottleneck
        const filepath = path.join(this.dirName, m.filename);
        try {
          await fs.access(filepath);
        } catch {
          // File does not exist
          await trimClip(
            m.sourcePath,
            m.start,
            m.end,
            filepath,
          );
        }
      }
    }

    if (this.command == Command.Upload) {
      for (const m of metadata) {
        await this.upload(youtubeOauthClient as OAuth2Client, m);
      }
    }
  }

  private async writeSingleVideoMetadata(
    graphqlClient: GraphQLClient,
    setList: Log,
    tournament: Tournament,
    videogame: Videogame,
    phase: Phase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata> {
    const metadata = await this.singleVideoMetadata(
      graphqlClient,
      setList,
      tournament,
      videogame,
      phase,
      setToPhaseGroupId,
    );
    const file = path.join(this.dirName, 'full.yml');
    const data = yaml.safeDump(metadata);
    await fs.writeFile(file, data);
    return metadata;
  }

  private async writePerSetMetadata(
    graphqlClient: GraphQLClient,
    setList: Log,
    tournament: Tournament,
    videogame: Videogame,
    phase: Phase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata[]> {
    const metadata = await this.perSetMetadata(
      graphqlClient,
      setList,
      tournament,
      videogame,
      phase,
      setToPhaseGroupId,
    );
    Promise.all(metadata.map((m, i) => {
      const file = path.join(this.dirName, `set-${i.toString().padStart(2, '0')}.yml`);
      const data = yaml.safeDump(m);
      return fs.writeFile(file, data);
    }));
    return metadata;
  }

  private async singleVideoMetadata(
    graphqlClient: GraphQLClient,
    setList: Log,
    tournament: Tournament,
    videogame: Videogame,
    phase: Phase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata> {
    if (!setList.start) {
      throw new Error('No start timestamp on log');
    }
    if (!setList.end) {
      throw new Error('No end timestamp on log');
    }

    let smashggSets: PhaseSetQueryResponse['phase']['sets']['nodes'] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const phaseSets = (await graphqlClient.request(PHASE_SET_QUERY, {
        phaseId: setList.phaseId,
        page: page++,
      }) as PhaseSetQueryResponse).phase;
      if (phaseSets) {
        smashggSets = smashggSets.concat(phaseSets.sets.nodes);
        totalPages = phaseSets.sets.pageInfo.totalPages;
      }
    }

    let sets;
    if (setList.sets) {
      sets = setList.sets.map(logSet => {
        const smashggSet = smashggSets.find(s => s.id.toString() == logSet.id);
        return getSetData(logSet, smashggSet);
      });
    } else {
      smashggSets.sort((a, b) => a.completedAt - b.completedAt);
      sets = smashggSets.map(s => getSetData(undefined, s));
    }

    // Make timestamps relative to the start of the video
    const phaseStart = nearestKeyframe(setList.start);
    const offsetTimestamp = (t: Timestamp): Timestamp => {
      return subtractTimestamp(nearestKeyframe(t), phaseStart);
    };
    sets.forEach(set => set.start = set.start ? offsetTimestamp(set.start) : '0:00:00');

    const title = setList.title || [
      `${tournament.shortName}:`,
      videogame.name,
      phase.name,
    ].filter(nonEmpty).join(' ');

    const matchDescs = sets.map(set => {
      const players = set.players;
      const groupId = setToPhaseGroupId[set.id] ? `${setToPhaseGroupId[set.id]} ` : '';
      const p1 = players[0].name;
      const p2 = players[1].name;
      return `${set.start} - ${p1} vs ${p2} (${groupId}${set.fullRoundText})`;
    }).join('\n');
    const description = videoDescription(tournament, videogame, phase, matchDescs);

    const players = sets.map(s => s.players)
      .reduce((acc, val) => acc.concat(val), []);
    const tags = videoTags(
      tournament,
      videogame,
      phase,
      players,
      setList.excludedTags || [],
      (setList.additionalTags || []).concat(phase.name),
    );

    const filename = filenamify(`${setList.start} `, { replacement: '-' }) +
        filenamify(title, { replacement: ' ' }) +
        '.mkv';

    return {
      sourcePath: setList.file,
      start: setList.start,
      end: setList.end,
      filename,
      title,
      description,
      tags,
    };
  }

  private async perSetMetadata(
    graphqlClient: GraphQLClient,
    setList: Log,
    tournament: Tournament,
    videogame: Videogame,
    phase: Phase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata[]> {
    const promises = setList.sets.map(async (timestampedSet, index) => {
      if (!timestampedSet.start || !timestampedSet.end) {
        throw new Error(`set ${index} is missing timestamps`);
      }

      const smashggSet = timestampedSet.id ? (await graphqlClient.request(SET_QUERY, {
        setId: timestampedSet.id,
      }) as SetQueryResponse).set || undefined : undefined;
      const set = getSetData(timestampedSet, smashggSet);
      logger.debug(set);
      const players = set.players;

      const title = [
        `${tournament.shortName}:`,
        `${players[0].name} vs ${players[1].name}`,
        '-',
        videogame.shortName,
        setToPhaseGroupId[set.id],
        phase.name,
        set.fullRoundText,
      ].filter(nonEmpty).join(' ');

      const matchDesc = [
        videogame.name,
        phase.name,
        setToPhaseGroupId[set.id],
        `${set.fullRoundText}:`,
        `${players[0].name} vs ${players[1].name}`,
      ].filter(nonEmpty).join(' ');
      const description = videoDescription(tournament, videogame, phase, matchDesc);

      const tags = videoTags(
        tournament,
        videogame,
        phase,
        players,
        setList.excludedTags || [],
        [phase.name]);

      const filename = filenamify(`${timestampedSet.start} `, { replacement: '-' }) +
          filenamify(title, { replacement: ' ' }) +
          '.mkv';

      return {
        sourcePath: setList.file,
        start: timestampedSet.start,
        end: timestampedSet.end,
        filename,
        title,
        description,
        tags,
      };
    });
    return Promise.all(promises);
  }

  private async upload(auth: OAuth2Client, m: Metadata): Promise<void> {
    if (!auth.credentials['access_token']) {
      throw new Error('No credentials on OAuth client');
    }
    const accessToken = auth.credentials['access_token'];

    checkMetadataSize(m);

    const videoFile = path.join(this.dirName, m.filename);
    const uploadFile = videoFile + '.upload.json';
    try {
      await fs.access(uploadFile);
      logger.info(`Upload log already found for "${m.filename}"`);
    } catch {
      // File does not exist
      logger.info(`Uploading "${m.filename}"...`);
      const data = {
        snippet: {
          title: m.title,
          description: m.description,
          tags: m.tags,
          categoryId: GAMING_CATEGORY_ID,
        },
        status: {
          privacyStatus: 'private',
        },
      };
      const resumable = new ResumableUpload();
      resumable.tokens = { 'access_token': accessToken };
      resumable.filepath = videoFile;
      resumable.metadata = data;
      resumable.monitor = true;
      resumable.retry = -1;
      const video = await runUpload(resumable);
      logger.info(`Video "${m.filename}" uploaded with id ${video.id}`);
      await fs.writeFile(uploadFile, JSON.stringify(video, null, 2));
    }
  }
}

function checkMetadataSize(m: Metadata): void {
  const title = titleSize(m.title);
  if (title > MAX_TITLE_SIZE) {
    throw new Error(`Title too long (${title}/${MAX_TITLE_SIZE})`);
  }

  const desc = descriptionSize(m.description);
  if (desc > MAX_DESCRIPTION_SIZE) {
    throw new Error(`Description too long (${desc}/${MAX_DESCRIPTION_SIZE})`);
  }

  const tags = tagsSize(m.tags);
  if (tags > MAX_TAGS_SIZE) {
    throw new Error(`Too many tags (${tags}/${MAX_TAGS_SIZE})`);
  }
}

function dumpMetadata(m: Metadata): void {
  const title = titleSize(m.title);
  const desc = descriptionSize(m.description);
  const tags = tagsSize(m.tags);
  console.log(`
Title (${title}/${MAX_TITLE_SIZE}):
${m.title}

Description (${desc}/${MAX_DESCRIPTION_SIZE}):
${m.description}

Tags (${tags}/${MAX_TAGS_SIZE}):
${m.tags.join(', ')}`);
}

function runUpload(resumable: ResumableUpload): Promise<youtubeV3.Schema$Video> {
  return new Promise((resolve, reject) => {
    const fileSize = fsSync.statSync(resumable.filepath).size;
    const total = fileSize.toString();
    resumable.on('progress', function(progress: string) {
      const current = progress.padStart(total.length, ' ');
      const percentage = (+progress / fileSize * 100).toFixed(2).padStart(5, ' ');
      logger.info(`${current}B / ${total}B (${percentage}%)`);
      process.title = `Uploading: ${percentage}%`;
    });
    resumable.on('error', function(error: unknown) {
      reject(error);
    });
    resumable.on('success', function(resp: string) {
      resolve(JSON.parse(resp) as youtubeV3.Schema$Video);
    });
    resumable.upload();
  });
}

async function getEventInfo(graphqlClient: GraphQLClient, setList: Log): Promise<{
  tournament: Tournament;
  videogame: Videogame;
  phase: Phase;
}> {
  const smashggEvent: QueryEvent = setList.eventId &&
    (await graphqlClient.request(EVENT_QUERY, { eventId: setList.eventId })).event;
  const event: QueryEvent = merge({}, smashggEvent, setList.event);
  logger.debug('Event:', event);

  const partialTournament: Partial<Tournament> & QueryTournament = event.tournament;
  partialTournament.shortName = partialTournament.shortName || partialTournament.name;
  partialTournament.additionalTags = partialTournament.additionalTags || [];
  const tournament: Tournament = partialTournament as Tournament;
  logger.debug('Tournament:', tournament);

  const partialVg: Partial<Videogame> & QueryVideogame = event.videogame;
  partialVg.name = nameOverrides[partialVg.id] || partialVg.name;
  partialVg.hashtag = getGameHashtag(partialVg.id);
  partialVg.shortName = partialVg.name.length - partialVg.hashtag.length < 3 ?
    partialVg.name :
    partialVg.hashtag;
  partialVg.additionalTags = additionalTags[partialVg.id] || [];
  const videogame: Videogame = partialVg as Videogame;
  logger.debug('Videogame:', videogame);

  const phase = (await graphqlClient.request(PHASE_QUERY, {
    phaseId: setList.phaseId,
  }) as PhaseQueryResponse).phase || { name: '' };
  phase.name = setList.phaseName ||
    (phase.name === 'Bracket' ? '' : phase.name);
  logger.debug('Phase:', phase);

  return { tournament, videogame, phase };
}

function getGameHashtag(id: number): string {
  const hashtag = gameHashtags[id];
  if (hashtag == null) {
    throw new Error(`no hashtag for game ${id}`);
  }
  return hashtag;
}

async function getPhaseGroupMapping(
  graphqlClient: GraphQLClient,
  phaseId: string | undefined,
): Promise<SetPhaseGroupMapping> {
  if (!phaseId) {
    return {};
  }
  const phase = (await graphqlClient.request(PHASE_GROUP_SET_QUERY, {
    phaseId,
  }) as PhaseGroupSetQueryResponse).phase;
  const phaseGroups = phase ? phase.phaseGroups.nodes : [];
  if (phaseGroups.length < 2) {
    return {};
  }
  const mapping: SetPhaseGroupMapping = {};
  for (const group of phaseGroups) {
    for (const set of group.sets.nodes) {
      mapping[set.id] = group.displayIdentifier;
    }
  }
  return mapping;
}

function videoDescription(
  tournament: Tournament,
  videogame: Videogame,
  phase: Phase,
  matchDesc: string,
): string {
  const date = formatDate(
    phase.waves ? phase.waves[0].startAt : tournament.startAt,
    phase.waves ? null : tournament.endAt,
    tournament.timezone,
  );

  const hashtags = [
    tournament.hashtag,
    videogame.hashtag,
  ];

  return `${matchDesc}

${tournament.name}
${date}
${[tournament.venueName, tournament.venueAddress].filter(nonEmpty).join(' - ')}
${tournament.url}

Follow us for more!
Twitch ► https://twitch.tv/lunarphaselive
Twitter ► https://twitter.com/LunarPhaseProd
Store ► https://store.lunarphase.nyc

${hashtags.filter(nonEmpty).map(str => "#" + str).join(' ')}`;
}

function formatDate(start: number | null, end: number | null, timezone: string | null): string {
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

function videoTags(
  tournament: Tournament,
  videogame: Videogame,
  phase: Phase,
  players: Set['players'],
  excludedTags: string[],
  additionalTags: string[],
): string[] {
  const playerTags = players.flatMap(p => [
    p.prefix && `${p.prefix} ${p.handle}`,
    p.handle,
  ]);

  const tags = [
    videogame.name,
    videogame.hashtag,
    ...videogame.additionalTags,
    `${videogame.shortName} ${phase.name}`,
    ...interpolate(
      [tournament.shortName, ...tournament.additionalTags],
      [videogame.name, videogame.hashtag],
    ),
    ...playerTags,
    ...additionalTags,
    ...tournamentTags(tournament),
    ...groupTags(),
  ].filter(nonEmpty).map(sanitizeTag).filter(nonEmpty);

  let tagsSet = new Set(tags);
  excludedTags.forEach(tagsSet.delete.bind(tagsSet));
  return Array.from(tagsSet);
}

function getSetData(logSet: Partial<Log['sets'][0]> = {}, smashggSet: Partial<QuerySet> = {}): Set {
  const set: Partial<Set> = {};

  // ID
  set.id = logSet.id || smashggSet.id;

  // Players
  if (logSet.state && logSet.state.players) {
    set.players = logSet.state.players.map(p => p.person).map(p => ({
      name: p.prefix ? `${p.prefix} | ${p.handle}` : p.handle,
      handle: p.handle,
      prefix: p.prefix,
    }));
  } else if (smashggSet.slots) {
    set.players = smashggSet.slots.map(slot => {
      let name;
      let handle;
      let prefix = null;
      if (slot.entrant.participants.length === 1) {
        const part = slot.entrant.participants[0];
        prefix = part.prefix || part.player.prefix;
        handle = part.player.gamerTag;
        name = prefix ? `${prefix} | ${handle}` : handle;
      } else {
        handle = slot.entrant.name;
        name = slot.entrant.name;
      }
      return { name, handle, prefix };
    });
  }

  // Match
  if (smashggSet.fullRoundText) {
    set.fullRoundText = smashggSet.fullRoundText;
  } else if (logSet.state && logSet.state.match) {
    set.fullRoundText = logSet.state.match.name;
  }
  if (set.fullRoundText == 'Grand Final Reset' || set.fullRoundText == 'True Finals') {
    set.fullRoundText = 'Grand Final';
  }

  // Timestamps
  set.start = logSet.start;
  set.end = logSet.end || undefined;
  return set as Set;
}

async function trimClip(
  sourceFile: string,
  start: Timestamp,
  end: Timestamp,
  outFile: string,
): Promise<void> {
  const keyframe = nearestKeyframe(start);
  logger.debug(`Choosing keyframe ${keyframe} for timestamp ${start}`);
  logger.info(`Cutting ${keyframe} to ${end} from ${sourceFile}, saving to ${outFile}`);
  const args = [
    '--verbose',
    '--output', outFile,
    '--split', `parts:${keyframe}-${end}`,
    sourceFile,
  ];
  const { stdout, stderr } = await pExecFile('mkvmerge', args);
  if (stdout) {
    logger.debug(stdout);
  }
  if (stderr) {
    logger.warn(stderr);
  }
}

function nearestKeyframe(timestamp: Timestamp): Timestamp {
  const duration = moment.duration(timestamp);
  let seconds = duration.asSeconds();
  seconds = seconds - seconds % keyframeInterval;
  return moment.utc(seconds * 1000).format('H:mm:ss.SSS');
}

function subtractTimestamp(a: Timestamp, b: Timestamp): Timestamp {
  const duration = moment.duration(a).subtract(moment.duration(b));
  let seconds = duration.asSeconds();
  return moment.utc(seconds * 1000).format('H:mm:ss');
}

function tournamentTags(tournament: Tournament): string[] {
  const ret = [
    tournament.name,
    tournament.hashtag,
    tournament.city,
    tournament.venueName,
    ...(tournament.additionalTags || []),
  ].filter(nonEmpty);

  const TOURNAMENT_SERIES_PATTERN = /^(.*)\s+#?\d+$/;
  const regExpResult = TOURNAMENT_SERIES_PATTERN.exec(tournament.name);
  if (regExpResult) {
    ret.push(regExpResult[1]);
  }
  return ret;
}

function* interpolate(arr1: string[], arr2: string[]): Generator<string> {
  for (const s1 of arr1) {
    for (const s2 of arr2) {
      yield `${s1} ${s2}`;
    }
  }
}

function groupTags(): string[] {
  return [
    'LP',
    'LunarPhase',
    'Lunar Phase',
    'LunarPhaseLive',
  ];
}

function sanitizeTag(str: string): string {
  // TODO: Actually make this an exhaustive list?
  return str.replace(/[,.?!|/\\(){}\[\]]/g, '')
    .trim();
}
