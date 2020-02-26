#!/usr/bin/env node

import childProcess from 'child_process';
import filenamify from 'filenamify';
import fsSync, { promises as fs } from 'fs';
import { google, youtube_v3 as youtubeV3 } from 'googleapis';
import { GraphQLClient } from 'graphql-request';
import yaml from 'js-yaml';
import merge from 'lodash.merge';
import moment from 'moment';
import ResumableUpload from 'node-youtube-resumable-upload';
import path from 'path';
import util from 'util';

import { SmashggId } from '../models/smashgg';
import { Timestamp } from '../models/timestamp';
import { Log as RecordingLog } from '../server/recording/log';
import { getCredentials } from '../util/credentials';
import SmashggClient from '../util/smashgg';

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
    handle: string;
  }[];
  fullRoundText: string;
  start: Timestamp;
  end: Timestamp;
}

type Log = RecordingLog & {
  phaseName?: string;
  event?: Partial<{
    tournament: Partial<Tournament>;
    videogame: Partial<Videogame>;
  }>;
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

const pExecFile = util.promisify(childProcess.execFile);
const NON_EMPTY = (str: string | null): str is string => !!str;
const GAMING_CATEGORY_ID = '20';

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
    await fs.mkdir(this.dirName, { recursive: true });
    const graphqlClient = new SmashggClient().getClient();
    const setList: Log = JSON.parse(await fs.readFile(this.logFile, { encoding: 'utf8' }));
    const { tournament, videogame, phase } = await getEventInfo(graphqlClient, setList);
    const setToPhaseGroupId = await getPhaseGroupMapping(graphqlClient, setList.phaseId);

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

    if (this.command >= Command.Upload) {
      const token = getCredentials().youtubeAccessToken;
      if (!token) {
        throw new Error('YouTube access token not provided in detocs-credentials.json');
      }
      // TODO: OAuth
      const auth = new google.auth.OAuth2();
      auth.credentials = {
        'access_token': token,
      };
      for (const m of metadata) {
        await this.upload(auth, m);
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
    fs.writeFile(file, data);
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
    metadata.forEach((m, i) => {
      const file = path.join(this.dirName, `set-${i.toString().padStart(2, '0')}.yml`);
      const data = yaml.safeDump(m);
      fs.writeFile(file, data);
    });
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

    const phaseSets = (await graphqlClient.request(PHASE_SET_QUERY, {
      phaseId: setList.phaseId,
    }) as PhaseSetQueryResponse).phase;
    let smashggSets = phaseSets ? phaseSets.sets.nodes : [];

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

    const title = [
      `${tournament.shortName}:`,
      videogame.name,
      phase.name,
    ].filter(NON_EMPTY).join(' ');

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
    const tags = videoTags(tournament, videogame, phase, players, [phase.name]);

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
      console.log(smashggSet);
      const set = getSetData(timestampedSet, smashggSet);
      console.log(set);
      const players = set.players;

      const title = [
        `${tournament.shortName}:`,
        `${players[0].name} vs ${players[1].name}`,
        '-',
        videogame.shortName,
        setToPhaseGroupId[set.id],
        phase.name,
        set.fullRoundText,
      ].filter(NON_EMPTY).join(' ');

      const matchDesc = [
        videogame.name,
        phase.name,
        setToPhaseGroupId[set.id],
        `${set.fullRoundText}:`,
        `${players[0].name} vs ${players[1].name}`,
      ].filter(NON_EMPTY).join(' ');
      const description = videoDescription(tournament, videogame, phase, matchDesc);

      const tags = videoTags(tournament, videogame, phase, players, [phase.name]);

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

  private async upload(auth: any, m: Metadata): Promise<void> {
    const videoFile = path.join(this.dirName, m.filename);
    const uploadFile = videoFile + '.upload.json';
    try {
      await fs.access(uploadFile);
    } catch {
      // File does not exist
      console.log(`Uploading "${m.filename}"...`);
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
      resumable.tokens = auth.credentials;
      resumable.filepath = videoFile;
      resumable.metadata = data;
      resumable.monitor = true;
      resumable.retry = -1;
      const video = await runUpload(resumable);
      console.log(video);
      fs.writeFile(uploadFile, JSON.stringify(video, null, 2));
      console.log(`Video "${m.filename}" uploaded with id ${video.id}`);
    }
  }
}

function runUpload(resumable: ResumableUpload): Promise<youtubeV3.Schema$Video> {
  return new Promise((resolve, reject) => {
    const fileSize = fsSync.statSync(resumable.filepath).size;
    const total = fileSize.toString();
    resumable.on('progress', function(progress: string) {
      const current = progress.padStart(total.length, ' ');
      const percentage = (+progress / fileSize * 100).toFixed(2);
      console.log(`${current}B / ${total}B (${percentage}%)`);
    });
    resumable.on('error', function(error: unknown) {
      reject(error);
    });
    resumable.on('success', function(video: youtubeV3.Schema$Video) {
      resolve(video);
    });
    resumable.upload();
  });
}

async function getEventInfo(graphqlClient: GraphQLClient, setList: Log): Promise<{
  tournament: Tournament;
  videogame: Videogame;
  phase: Phase;
}> {
  const phase = (await graphqlClient.request(PHASE_QUERY, {
    phaseId: setList.phaseId,
  }) as PhaseQueryResponse).phase || { name: '' };
  phase.name = setList.phaseName ||
    (phase.name === 'Bracket' ? '' : phase.name);
  console.log(phase);

  const smashggEvent: QueryEvent = setList.eventId &&
    (await graphqlClient.request(EVENT_QUERY, { eventId: setList.eventId })).event;
  const event: QueryEvent = merge({}, smashggEvent, setList.event);
  console.log(event);

  const partialTournament: Partial<Tournament> & QueryTournament = event.tournament;
  partialTournament.shortName = partialTournament.shortName || partialTournament.name;
  partialTournament.additionalTags = partialTournament.additionalTags || [];
  const tournament: Tournament = partialTournament as Tournament;

  const partialVg: Partial<Videogame> & QueryVideogame = event.videogame;
  console.log(partialVg);
  partialVg.name = nameOverrides[partialVg.id] || partialVg.name;
  partialVg.hashtag = getGameHashtag(partialVg.id);
  console.log(partialVg);
  partialVg.shortName = partialVg.name.length - partialVg.hashtag.length < 3 ?
    partialVg.name :
    partialVg.hashtag;
  partialVg.additionalTags = additionalTags[partialVg.id] || [];
  const videogame: Videogame = partialVg as Videogame;

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
  const timestamp = phase.waves ? phase.waves[0].startAt : tournament.startAt;
  const date = moment.unix(timestamp).format('LL');

  const hashtags = [
    tournament.hashtag,
    videogame.hashtag,
  ];

  return `${matchDesc}
    
${tournament.name}
${date}
${tournament.venueName} - ${tournament.venueAddress}
${tournament.url}

Follow us for more!
Twitch ► https://twitch.tv/lunarphaselive 
Twitter ► https://twitter.com/LunarPhaseProd
Store ► https://store.lunarphase.nyc

${hashtags.filter(NON_EMPTY).map(str => "#" + str).join(' ')}`;
}

function videoTags(
  tournament: Tournament,
  videogame: Videogame,
  phase: Phase,
  players: Set['players'],
  additionalTags: string[],
): string[] {
  const playerTags = players.map(p => [p.name, p.handle])
    .reduce((acc, val) => acc.concat(val), []);

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
  ].filter(NON_EMPTY);

  return Array.from(new Set(tags));
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
    }));
  } else if (smashggSet.slots) {
    set.players = smashggSet.slots.map(slot => {
      let name;
      let handle;
      if (slot.entrant.participants.length === 1) {
        const part = slot.entrant.participants[0];
        const prefix = part.prefix || part.player.prefix;
        handle = part.player.gamerTag;
        name = prefix ? `${prefix} | ${handle}` : handle;
      } else {
        handle = slot.entrant.name;
        name = slot.entrant.name;
      }
      return { name, handle };
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
  console.log(start, keyframe, end);
  const args = [
    '-ss', keyframe,
    '-to', end,
    '-i', sourceFile,
    '-codec', 'copy',
    '-avoid_negative_ts', '1',
    '-y',
    outFile,
  ];
  const { stderr } = await pExecFile('ffmpeg', args);
  if (stderr) {
    console.log(stderr);
  }
}

function nearestKeyframe(timestamp: Timestamp): Timestamp {
  const duration = moment.duration(timestamp);
  let seconds = duration.asSeconds();
  seconds = seconds - seconds % 3;
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
  ];

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
