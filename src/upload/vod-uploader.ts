import { youtube_v3 as youtubeV3 } from '@google/youtube/v3';
import filenamify from 'filenamify';
import fsSync, { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import yaml from 'js-yaml';
import merge from 'lodash.merge';
import moment from 'moment-timezone';
import { err, ok, ResultAsync } from 'neverthrow';
import ResumableUpload from 'node-youtube-resumable-upload';
import path from 'path';

import Character from '@models/character';
import Game from '@models/game';
import { getGameById, getGameByServiceId, loadGameDatabase } from '@models/games';
import Person, { getPrefixedAlias } from '@models/person';
import { Timestamp } from '@models/timestamp';
import Tournament from '@models/tournament';
import TournamentSet, { TournamentEntrant } from '@models/tournament-set';
import BracketService from '@services/bracket-service';
import BracketServiceProvider from '@services/bracket-service-provider';
import {
  getYoutubeAuthClient,
  tagsSize,
  MAX_TAGS_SIZE,
  descriptionSize,
  MAX_DESCRIPTION_SIZE,
  titleSize,
  MAX_TITLE_SIZE,
  getVideoByName,
  updateVideo,
  titleify,
  sanitizeTag,
  sanitizeTitle,
  sanitizeDescription,
  SanitizedTitle,
  SanitizedDescription,
  SanitizedTag,
  GAMING_CATEGORY_ID,
} from '@services/youtube';
import { mode } from '@util/array';
import { getConfig } from '@util/configuration/config';
import { KeyframeSource } from '@util/keyframe-source';
import { getLogger } from '@util/logger';
import { trimVideo } from '@util/mkvmerge';
import { nonEmpty, nonNull } from '@util/predicates';

import { loadLog } from './loader';
import { videoDescription, getSingleVideoTemplate, getPerSetTemplate } from './templating';
import { Log, VodTournament, VodVideogame, VodPhase } from './types';

const logger = getLogger('upload');

interface Set {
  id: string | null;
  phaseGroupId: string | null;
  players: {
    name: string;
    prefix: string | null;
    handle: string;
    alias: string | null;
    characters?: Character[];
  }[];
  fullRoundText: string | null;
  start: Timestamp | null;
  end: Timestamp | null;
}

interface Metadata {
  sourcePath: string;
  start: Timestamp;
  end: Timestamp;
  filename: string;
  title: SanitizedTitle;
  description: SanitizedDescription;
  tags: SanitizedTag[];
}

export enum Command {
  Metadata,
  Video,
  Upload,
  Update,
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
  videoNum: number | undefined;
}

interface PhaseGroupNameMapping {
  get: (phaseGroupId?: string | null) => string | undefined;
}

export class VodUploader {
  private readonly bracketProvider: BracketServiceProvider;
  private readonly logFile: string;
  private readonly dirName: string;
  private readonly command: Command;
  private readonly style: Style;
  private readonly videoNum: number | undefined;

  public constructor({ bracketProvider, logFile, command, style, videoNum }: VodUploaderParams) {
    this.bracketProvider = bracketProvider;
    this.logFile = logFile;
    this.dirName = path.join(
      path.dirname(logFile),
      path.basename(logFile, path.extname(logFile))
    );
    this.command = command;
    this.style = style;
    this.videoNum = videoNum;
  }

  public async run(): Promise<void> {
    await loadDatabases();

    let youtubeOauthClient: OAuth2Client | null = null;
    if (this.command == Command.Upload || this.command == Command.Update) {
      // Get YouTube credentials first, so that the rest can be done unattended
      const res = await getYoutubeAuthClient();
      if (res.isErr()) {
        throw res._unsafeUnwrapErr();
      }
      youtubeOauthClient = res._unsafeUnwrap();
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
    const keyframeSource = await getKeyframeSource(path.dirname(this.logFile), setList);

    let metadata: Metadata[] = [];
    if (this.command >= Command.Metadata) {
      if (this.style === Style.PerSet) {
        metadata = await this.writePerSetMetadata(
          bracketService,
          setList,
          tournament,
          videogame,
          phase,
        );
      } else {
        metadata = [await this.writeSingleVideoMetadata(
          bracketService,
          keyframeSource,
          setList,
          tournament,
          videogame,
          phase,
        )];
      }
      if (this.videoNum && this.videoNum > 0 && this.videoNum <= metadata.length) {
        metadata = metadata.slice(this.videoNum - 1, this.videoNum);
      }
    }

    for (const m of metadata) {
      dumpMetadata(m);
    }

    if (this.command >= Command.Video && this.command <= Command.Upload) {
      for (const m of metadata) {
        // Don't bother parallelizing, since reading from the source file is the bottleneck
        const filepath = path.join(this.dirName, m.filename);
        try {
          await fs.access(filepath);
          logger.info(`${filepath} already exists, skipping cut`);
        } catch {
          // File does not exist
          await trimVideo(
            keyframeSource,
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

    if (this.command == Command.Update) {
      for (const m of metadata) {
        await this.update(youtubeOauthClient as OAuth2Client, m);
      }
    }
  }

  private async writeSingleVideoMetadata(
    bracketService: BracketService | null,
    keyframeSource: KeyframeSource,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
  ): Promise<Metadata> {
    const metadata = await this.singleVideoMetadata(
      bracketService,
      keyframeSource,
      setList,
      tournament,
      videogame,
      phase,
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
  ): Promise<Metadata[]> {
    const metadata = await this.perSetMetadata(
      bracketService,
      setList,
      tournament,
      videogame,
      phase,
    );
    await Promise.all(metadata.map((m, i) => {
      const file = path.join(this.dirName, `set-${i.toString().padStart(2, '0')}.yml`);
      const data = yaml.safeDump(m);
      return fs.writeFile(file, data);
    }));
    return metadata;
  }

  private async singleVideoMetadata(
    bracketService: BracketService | null,
    keyframeSource: KeyframeSource,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
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
    const phaseGroupNames = await getPhaseGroupNameMapping(tournament, bracketService);

    let sets;
    if (setList.sets) {
      sets = setList.sets.map(logSet => {
        const bracketSet = backetsSets.find(s => s.serviceInfo.id == logSet.id);
        return getSetData(logSet, bracketSet, phaseGroupNames);
      });
    } else {
      backetsSets.sort((a, b) =>
        (a.completedAt || Number.MAX_SAFE_INTEGER) - (b.completedAt || Number.MAX_SAFE_INTEGER));
      sets = backetsSets.map(s => getSetData(undefined, s, phaseGroupNames));
    }

    // Make timestamps relative to the start of the video
    const phaseStart = keyframeSource.closestPrecedingKeyframe(setList.start);
    const offsetTimestamp = (t: Timestamp): Timestamp => {
      return subtractTimestamp(keyframeSource.closestPrecedingKeyframe(t), phaseStart);
    };
    sets.forEach(set => set.start = set.start ? offsetTimestamp(set.start) : '0:00:00');

    const defaultTitle = [
      `${tournament.shortName}:`,
      videogame.name,
      phase.name,
    ].filter(nonEmpty).join(' ');
    const title = setList.title || defaultTitle;

    const commentators = setList.commentators ??
      getCommentators(setList.sets) ??
      '';

    const matchDescs = sets.map(set => {
      const players = set.players;
      const p1 = players[0].name;
      const p2 = players[1].name;
      const match = set.fullRoundText ? ` (${set.fullRoundText})` : '';
      return `${set.start} - ${p1}${characterList(players[0])} vs ${p2}${characterList(players[1])}${match}`;
    }).join('\n');
    const template = await getSingleVideoTemplate();
    const description = videoDescription(
      template,
      tournament,
      videogame,
      phase,
      setList.matchDescription || matchDescs,
      commentators,
      setList.userData || {},
    );

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
        filenamify(defaultTitle, { replacement: ' ' }) +
        '.mkv';

    return {
      sourcePath: setList.file,
      start: setList.start,
      end: setList.end,
      filename,
      title: sanitizeTitle(title),
      description: sanitizeDescription(description),
      tags,
    };
  }

  private async perSetMetadata(
    bracketService: BracketService | null,
    setList: Log,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
  ): Promise<Metadata[]> {
    const bracketSets = isValidPhase(setList.phaseId) &&
      await bracketService?.upcomingSetsByPhase(setList.phaseId) ||
      [];
    const phaseGroupNames = await getPhaseGroupNameMapping(tournament, bracketService);
    const template = await getPerSetTemplate();
    const promises = setList.sets.map(async (timestampedSet, index) => {
      if (!timestampedSet.start || !timestampedSet.end) {
        throw new Error(`set ${index} is missing timestamps`);
      }

      const bracketSet = bracketSets.find(s => s.serviceInfo.id === timestampedSet.id);
      const set = getSetData(timestampedSet, bracketSet, phaseGroupNames);
      const players = set.players;

      const fullVsText = `${players[0].name}${characterList(players[0])} vs ${players[1].name}${characterList(players[1])}`;
      const basicTitle = [
        `${tournament.shortName}:`,
        `${players[0].name} vs ${players[1].name}`,
        '-',
        videogame.shortName,
        phase.name,
        set.fullRoundText,
      ].filter(nonEmpty).join(' ');
      const defaultTitle = [
        `${tournament.shortName}:`,
        fullVsText,
        '-',
        videogame.shortName,
        phase.name,
        set.fullRoundText,
      ].filter(nonEmpty).join(' ');
      const title = timestampedSet.title || defaultTitle;

      const commentators = timestampedSet.commentators ??
        setList.commentators ??
        getCommentators([timestampedSet]) ??
        '';

      const matchDesc = [
        videogame.name,
        phase.name,
        `${set.fullRoundText}:`,
        fullVsText,
      ].filter(nonEmpty).join(' ');
      const description = videoDescription(
        template,
        tournament,
        videogame,
        phase,
        matchDesc,
        commentators,
        setList.userData || {},
      );

      const tags = videoTags(
        tournament,
        videogame,
        phase,
        players,
        setList.excludedTags || [],
        [
          phase.name,
          ...(players[0].characters?.map(c => c.name) || []),
          ...(players[1].characters?.map(c => c.name) || []),
        ],
      );

      const filename = filenamify(`${timestampedSet.start} `, { replacement: '-' }) +
          filenamify(basicTitle, { replacement: ' ' }) +
          '.mkv';

      return {
        sourcePath: setList.file,
        start: timestampedSet.start,
        end: timestampedSet.end,
        filename,
        title: sanitizeTitle(title),
        description: sanitizeDescription(description),
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

  private async update(auth: OAuth2Client, m: Metadata): Promise<void> {
    checkMetadataSize(m);

    const videoFile = path.join(this.dirName, m.filename);
    const uploadFile = videoFile + '.upload.json';

    return ResultAsync
      .fromPromise(
        fs.readFile(uploadFile, { encoding: 'utf8' }),
        e => e as Error
      )
      .andThen(str => {
        try {
          const log: youtubeV3.Schema$Video = JSON.parse(str);
          return ok(log);
        } catch {
          return err<youtubeV3.Schema$Video, Error>(
            new Error(`Unable to parse JSON from ${uploadFile}`)
          );
        }
      })
      .andThen(json => {
        if (!json.id) {
          return err<string, Error>(new Error('Video data in upload log has no ID'));
        }
        logger.info(`Loaded video id from ${uploadFile}`);
        return ok(json.id);
      })
      .orElse(e => {
        logger.warn(e);
        const titleQuery = m.title;
        const filenameQuery = titleify(path.basename(m.filename, path.extname(m.filename)));
        return getVideoByName(auth, titleQuery)
          .andThen<{ video: youtubeV3.Schema$Video, name: string }>(video => {
          return video
            ? ok({video, name: titleQuery})
            : err(
              new Error(`No video found for query "${titleQuery}"`)
            );
        })
          .orElse(e => {
            logger.warn(e);
            return getVideoByName(auth, filenameQuery)
              .andThen<{ video: youtubeV3.Schema$Video, name: string }>(video => {
              return video
                ? ok({ video, name: filenameQuery })
                : err(
                  new Error(`No video found for query "${filenameQuery}"`)
                );
            });
          })
          .andThen(({ video, name }) => {
            if (!video.id) {
              return err<string, Error>(new Error('Video returned by search api has no ID'));
            }
            logger.info(`Searched YouTube for "${name}", found "${video.snippet?.title}`);
            return ok(video.id);
          });
      })
      .map(id => {
        logger.info(`YouTube video ID: ${id}`);
        return id;
      })
      .andThen(id => updateVideo(
        auth,
        id,
        {
          snippet: {
            title: m.title,
            description: m.description,
            tags: m.tags,
            categoryId: GAMING_CATEGORY_ID,
          },
        },
      ))
      .andThen(video => ResultAsync.fromPromise(
        fs.writeFile(uploadFile, JSON.stringify(video, null, 2))
          .then(() => video),
        e => e as Error,
      ))
      .match(
        video => logger.info(`Video "${video.id}" updated`),
        logger.error,
      );
  }
}

function getCommentators(sets: Log['sets']): string | undefined {
  return [...new Set(
    sets.flatMap(set => set.state?.commentators?.map(c => getPrefixedAlias(c.person)))
  )].filter(nonEmpty).join(', ');
}

async function loadDatabases(): Promise<void> {
  await loadGameDatabase();
}

async function getKeyframeSource(workingDir: string, setList: Log): Promise<KeyframeSource> {
  const keyframeIntervalSeconds = setList.keyframeInterval ||
    getConfig().vodKeyframeIntervalSeconds ||
    undefined;
  const keyframeSource = new KeyframeSource(keyframeIntervalSeconds
    ? { intervalMs: keyframeIntervalSeconds * 1000 }
    : { file: setList.file, outputDir: workingDir });
  await keyframeSource.init();
  return keyframeSource;
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

  const tournament: Partial<VodTournament> & Pick<Tournament, 'name'> = merge(
    { name: 'Unknown Tournament' },
    getTournamentFromState(setList),
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
  } else if (videogame == null) {
    videogame = getGameFromState(setList);
  }
  if (!videogame) {
    throw new Error('Cannot find videogame');
  }
  videogame.shortName = videogame.shortNames[0] || videogame.name;
  videogame.hashtag = videogame.hashtags[0] || undefined;
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

function getTournamentFromState(setList: Log): Pick<Tournament, 'name'> | null {
  const names = setList.sets.map(s => s.state?.tournament).filter(nonEmpty);
  const mostFrequent = mode(names);
  return mostFrequent ? { name: mostFrequent } : null;
}

function getGameFromState(setList: Log): Game | null {
  const ids = setList.sets.map(s => s.state?.game.id).filter(nonEmpty);
  const mostFrequentId = mode(ids);
  if (mostFrequentId) {
    return getGameById(mostFrequentId);
  }
  const names = setList.sets.map(s => s.state?.game.name).filter(nonEmpty);
  const mostFrequentName = mode(names);
  if (mostFrequentName) {
    return setList.sets.map(s => s.state?.game)
      .find(g => g?.name == mostFrequentName) ||
      null;
  }
  return null;
}

async function getPhaseGroupNameMapping(
  tournament: VodTournament,
  bracketService: BracketService | null,
): Promise<PhaseGroupNameMapping> {
  const tournamentPhaseGroups = isValidTournament(tournament.id) &&
    await bracketService?.phasesForTournament(tournament.id).then(t => t.phaseGroups) ||
    [];
  return {
    get(phaseGroupId) {
      if (!phaseGroupId) {
        return undefined;
      }
      const phaseGroup = tournamentPhaseGroups.find(pg => pg.id === phaseGroupId);
      if (!phaseGroup) {
        return undefined;
      }
      const phases = tournamentPhaseGroups.filter(pg => pg.phaseId === phaseGroup.phaseId);
      if (phases.length < 2) {
        return undefined;
      }

      if (phaseGroup.name.match(/^[A-Z]?\d+$/)) {
        return `Pool ${phaseGroup.name}`;
      }

      return phaseGroup.name;
    },
  };
}

function videoTags(
  tournament: VodTournament,
  videogame: VodVideogame,
  phase: VodPhase,
  players: Set['players'],
  excludedTags: string[],
  additionalTags: string[],
): SanitizedTag[] {
  const playerTags = players.flatMap(p => [
    p.prefix && `${p.prefix} ${p.handle}`,
    p.handle,
    p.alias,
  ]);

  const tags = [
    videogame.name,
    videogame.hashtag,
    ...videogame.additionalTags || [],
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

  const tagsSet = new Set(tags);
  excludedTags.map(sanitizeTag)
    .forEach(tagsSet.delete.bind(tagsSet));
  return Array.from(tagsSet);
}

function getSetData(
  logSet: Log['sets'][0] | undefined,
  bracketSet: TournamentSet | undefined,
  phaseGroupNames: PhaseGroupNameMapping,
): Set {
  // ID
  const id = logSet?.id || bracketSet?.serviceInfo?.id || null;
  const phaseGroupId = bracketSet?.serviceInfo?.phaseGroupId || null;

  // Players
  const players: Set['players'] = [];
  const numPlayers = Math.max(
    logSet?.state?.players?.length ?? 0,
    bracketSet?.entrants?.length ?? 0,
  );
  const parseLogPlayer = (p: Person): Set['players'][0] => ({
    name: getPrefixedAlias(p),
    handle: p.handle,
    prefix: p.prefix,
    alias: p.alias || null,
  });
  const parseBracketPlayer = (entrant: TournamentEntrant): Set['players'][0] => {
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
    return { name, handle, prefix, alias: null };
  };
  for (let i = 0; i < numPlayers; i++) {
    const logPerson = logSet?.state?.players[i].person;
    const bracketEntrant = bracketSet?.entrants[i];
    const characters = logSet?.state?.players[i].characters;
    if (logPerson) {
      players.push(Object.assign(parseLogPlayer(logPerson), { characters }));
    } else if (bracketEntrant) {
      players.push(Object.assign(parseBracketPlayer(bracketEntrant), { characters }));
    }
  }

  // Match
  // TODO: Only using smashgg IDs match names because they're singular
  const groupId = makePrefix(phaseGroupNames.get(phaseGroupId));
  let fullRoundText = (logSet?.state?.match?.smashggId && groupId + logSet.state.match.smashggId) ||
    logSet?.state?.match?.name ||
    (bracketSet?.match?.smashggId && groupId + bracketSet.match.smashggId) ||
    (bracketSet?.match?.name && groupId + bracketSet.match.name) ||
    null;
  // TODO: Is this even necessary?
  if (fullRoundText == 'Grand Final Reset' || fullRoundText == 'True Finals') {
    fullRoundText = 'Grand Final';
  }

  // Timestamps
  const start = logSet?.start || null;
  const end = logSet?.end || null;
  return {
    id,
    phaseGroupId,
    players,
    fullRoundText,
    start,
    end,
  };
}

function subtractTimestamp(a: Timestamp, b: Timestamp): Timestamp {
  const duration = moment.duration(a).subtract(moment.duration(b));
  const seconds = duration.asSeconds();
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
  for (const s1 of arr1.filter(nonNull)) {
    for (const s2 of arr2.filter(nonNull)) {
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

function isValidPhase(phaseId: string | null | undefined): phaseId is string {
  return !!phaseId && phaseId !== 'unknown';
}

function isValidTournament(tournamentId: string | null | undefined): tournamentId is string {
  return tournamentId != null;
}

function makePrefix(str?: string): string {
  return str && str + ' ' || '';
}

function characterList(player: Set['players'][0]): string {
  if (!player.characters || !player.characters.length) {
    return '';
  }
  return ` (${player.characters.map(c => c.name).join(', ')})`;
}
