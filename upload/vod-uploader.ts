import childProcess from 'child_process';
import filenamify from 'filenamify';
import fsSync, { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { youtube_v3 as youtubeV3 } from 'googleapis';
import yaml from 'js-yaml';
import merge from 'lodash.merge';
import moment from 'moment-timezone';
import ResumableUpload from 'node-youtube-resumable-upload';
import path from 'path';
import util from 'util';

import Game from '@models/game';
import { getGameById, getGameByServiceId } from '@models/games';
import { Timestamp } from '@models/timestamp';
import Tournament from '@models/tournament';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet from '@models/tournament-set';
import BracketService from '@services/bracket-service';
import BracketServiceProvider from '@services/bracket-service-provider';
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

import { loadLog } from './loader';
import { Log, VodTournament, VodVideogame } from './types';

const logger = getLogger('upload');

type VodPhase = Pick<TournamentPhase, 'name' | 'startAt'>;

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

type SetPhaseGroupMapping = Record<string, TournamentPhaseGroup>;

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
  bracketProvider: BracketServiceProvider;
  logFile: string;
  command: Command;
  style: Style;
}

const GAMING_CATEGORY_ID = '20';
const pExecFile = util.promisify(childProcess.execFile);
const nonEmpty = (str?: string | null): str is string => !!str;
let keyframeInterval = 3;

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
  private readonly bracketProvider: BracketServiceProvider;
  private readonly logFile: string;
  private readonly dirName: string;
  private readonly command: Command;
  private readonly style: Style;

  public constructor({ bracketProvider, logFile, command, style }: VodUploaderParams) {
    this.bracketProvider = bracketProvider;
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
    const setList: Log = await loadLog(this.logFile);
    const bracketService = setList.bracketService != null ?
      this.bracketProvider.get(setList.bracketService) :
      null;
    const { tournament, videogame, phase } = await getEventInfo(
      bracketService,
      setList,
    );
    const setToPhaseGroupId = await getPhaseGroupMapping(
      bracketService,
      setList.phaseId,
    );
    keyframeInterval = setList.keyframeInterval || keyframeInterval;

    let metadata: Metadata[] = [];
    if (this.command >= Command.Metadata) {
      if (this.style === Style.PerSet) {
        metadata = await this.writePerSetMetadata(
          bracketService,
          setList,
          tournament,
          videogame,
          phase,
          setToPhaseGroupId,
        );
      } else {
        metadata = [await this.writeSingleVideoMetadata(
          bracketService,
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
    bracketService: BracketService | null,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata> {
    const metadata = await this.singleVideoMetadata(
      bracketService,
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
    bracketService: BracketService | null,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata[]> {
    const metadata = await this.perSetMetadata(
      bracketService,
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
    bracketService: BracketService | null,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata> {
    if (!setList.start) {
      throw new Error('No start timestamp on log');
    }
    if (!setList.end) {
      throw new Error('No end timestamp on log');
    }

    const backetsSets = isValidPhase(setList.phaseId) &&
      await bracketService?.upcomingSetsByPhase(setList.phaseId) ||
      [];

    let sets;
    if (setList.sets) {
      sets = setList.sets.map(logSet => {
        const bracketSet = backetsSets.find(s => s.serviceInfo.id == logSet.id);
        return getSetData(logSet, bracketSet);
      });
    } else {
      backetsSets.sort((a, b) =>
        (a.completedAt || Number.MAX_SAFE_INTEGER) - (b.completedAt || Number.MAX_SAFE_INTEGER));
      sets = backetsSets.map(s => getSetData(undefined, s));
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
    bracketService: BracketService | null,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
    setToPhaseGroupId: SetPhaseGroupMapping,
  ): Promise<Metadata[]> {
    const bracketSets = isValidPhase(setList.phaseId) &&
      await bracketService?.upcomingSetsByPhase(setList.phaseId) ||
      [];
    const promises = setList.sets.map(async (timestampedSet, index) => {
      if (!timestampedSet.start || !timestampedSet.end) {
        throw new Error(`set ${index} is missing timestamps`);
      }

      const bracketSet = bracketSets.find(s => s.serviceInfo.id === timestampedSet.id);
      const set = getSetData(timestampedSet, bracketSet);
      logger.debug(set);
      const players = set.players;

      const title = [
        `${tournament.shortName}:`,
        `${players[0].name} vs ${players[1].name}`,
        '-',
        videogame.shortName,
        setToPhaseGroupId[set.id]?.name,
        phase.name,
        set.fullRoundText,
      ].filter(nonEmpty).join(' ');

      const matchDesc = [
        videogame.name,
        phase.name,
        setToPhaseGroupId[set.id]?.name,
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

async function getEventInfo(
  bracketService: BracketService | null,
  setList: Log,
): Promise<{
    tournament: VodTournament;
    videogame: VodVideogame;
    phase: VodPhase;
  }> {
  const { tournament: apiTournament, videogame: apiVideogame } = bracketService && setList.eventId ?
    await bracketService.eventInfo(setList.eventId) :
    { tournament: {}, videogame: null };

  const tournament: Partial<VodTournament> & Tournament = merge(
    apiTournament,
    setList.event?.tournament,
  ) as VodTournament;
  tournament.shortName = tournament.shortName || tournament.name;
  tournament.additionalTags = tournament.additionalTags || [];
  logger.debug('Tournament:', tournament);

  let videogame: (Partial<VodVideogame> & Game) | null = apiVideogame;
  if (setList.event?.videogame?.id) {
    const gameId = setList.event?.videogame?.id;
    if (bracketService?.name()) {
      videogame = getGameByServiceId(bracketService.name(), gameId.toString());
    } else {
      videogame = getGameById(gameId.toString());
    }
  }
  if (!videogame) {
    throw new Error('Cannot find videogame');
  }
  videogame.shortName = videogame.shortNames[0] || videogame.name;
  videogame.hashtag = videogame.hashtags[0] || undefined;
  // TODO: Add additionalTags to Game
  videogame.additionalTags = additionalTags[+videogame.serviceInfo['smashgg'].id] || [];
  logger.debug('Videogame:', videogame);

  const phaseId = setList.phaseId;
  const phase = Object.assign(
    { name: '', startAt: null },
    isValidPhase(phaseId) && await bracketService?.phase(phaseId),
    setList.phaseName && { name: setList.phaseName },
  );
  phase.name = phase.name === 'Bracket' ? '' : phase.name;
  logger.debug('Phase:', phase);

  return {
    tournament: tournament as VodTournament,
    videogame: videogame as VodVideogame,
    phase,
  };
}

async function getPhaseGroupMapping(
  bracketService: BracketService | null,
  phaseId: string | undefined,
): Promise<SetPhaseGroupMapping> {
  return isValidPhase(phaseId) && bracketService?.setIdToPhaseGroup(phaseId) || {};
}

function videoDescription(
  tournament: VodTournament,
  videogame: VodVideogame,
  phase: VodPhase,
  matchDesc: string,
): string {
  const date = formatDate(
    phase.startAt != null ? phase.startAt : tournament.startAt,
    phase.startAt != null ? null : tournament.endAt,
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

function videoTags(
  tournament: VodTournament,
  videogame: VodVideogame,
  phase: VodPhase,
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

function getSetData(
  logSet: Partial<Log['sets'][0]> = {},
  bracketSet: Partial<TournamentSet> = {},
): Set {
  const set: Partial<Set> = {};

  // ID
  set.id = logSet.id || bracketSet.serviceInfo?.id;

  // Players
  if (logSet.state && logSet.state.players) {
    set.players = logSet.state.players.map(p => p.person).map(p => ({
      name: p.prefix ? `${p.prefix} | ${p.handle}` : p.handle,
      handle: p.handle,
      prefix: p.prefix,
    }));
  } else if (bracketSet.entrants) {
    set.players = bracketSet.entrants.map(entrant => {
      let name;
      let handle;
      let prefix = null;
      if (entrant.participants.length === 1) {
        const part = entrant.participants[0];
        prefix = part.prefix;
        handle = part.handle;
        name = prefix ? `${prefix} | ${handle}` : handle;
      } else {
        handle = entrant.name;
        name = entrant.name;
      }
      return { name, handle, prefix };
    });
  }

  // Match
  // TODO: Only using smashgg IDs match names because they're singular
  set.fullRoundText = bracketSet.match?.smashggId ||
    logSet.state?.match.name ||
    undefined;
  // TODO: Is this even necessary?
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

function tournamentTags(tournament: VodTournament): string[] {
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

function isValidPhase(phaseId: string | null | undefined): phaseId is string {
  return !!phaseId && phaseId !== 'unknown';
}
