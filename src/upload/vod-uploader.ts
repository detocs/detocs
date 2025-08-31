import { youtube_v3 as youtubeV3 } from '@google/youtube/v3';
import filenamify from 'filenamify';
import fsSync, { promises as fs } from 'fs';
import { OAuth2Client } from 'google-auth-library';
import yaml from 'js-yaml';
import merge from 'lodash.merge';
import moment from 'moment-timezone';
import { err, ok, okAsync, ResultAsync } from 'neverthrow';
import ResumableUpload from 'node-youtube-resumable-upload';
import path from 'path';

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
import { nonEmpty } from '@util/predicates';

import { loadLog } from './loader';
import { getSingleVideoTemplate, getPerSetTemplate, getSingleVideoTitleTemplate, RawTemplateData, renderVodTemplate, getPerSetTitleTemplate } from './templating';
import { Log, Set, VodTournament, VodVideogame, VodPhase } from './types';

const logger = getLogger('upload');

interface Metadata {
  index: number | null;
  sourcePath: string;
  start: Timestamp;
  end: Timestamp;
  filename: string;
  title: SanitizedTitle;
  description: SanitizedDescription;
  tags: SanitizedTag[];
  uploadId: string | null;
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
  skipNotification: boolean | undefined;
}

interface PhaseGroupNameMapping {
  get: (phaseGroupId?: string | null) => string | undefined;
}
const EMPTY_PHASE_GROUP_MAPPING: PhaseGroupNameMapping = Object.freeze({
  get: () => undefined,
});

export class VodUploader {
  private readonly bracketProvider: BracketServiceProvider;
  private readonly logFile: string;
  private readonly logName: string;
  private readonly dirName: string;
  private readonly command: Command;
  private readonly style: Style;
  private readonly videoNum: number | undefined;
  private readonly skipNotification: boolean;

  public constructor({
    bracketProvider,
    logFile,
    command,
    style,
    videoNum,
    skipNotification,
  }: VodUploaderParams) {
    this.bracketProvider = bracketProvider;
    this.logFile = logFile;
    this.logName = path.basename(logFile, path.extname(logFile));
    this.dirName = path.join(
      path.dirname(logFile),
      this.logName,
    );
    this.command = command;
    this.style = style;
    this.videoNum = videoNum;
    this.skipNotification = skipNotification ?? false;
  }

  public async run(): Promise<void> {
    await loadDatabases();

    let youtubeOauthClient: OAuth2Client | null = null;
    if (this.command == Command.Upload || this.command == Command.Update) {
      // Get YouTube credentials first, so that the rest can be done unattended
      const res = await getYoutubeAuthClient();
      res.mapErr(e => {throw e;});
      youtubeOauthClient = res._unsafeUnwrap();
    }

    await fs.mkdir(this.dirName, { recursive: true });
    const setList: Readonly<Log> = await loadLog(this.logFile);
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
        const res = await this.upload(youtubeOauthClient as OAuth2Client, m)
          .andThen(uploadId => updateLogUploadId(this.logFile, uploadId, m.index));
        res.mapErr(e => {throw e;});
      }
    }

    if (this.command == Command.Update) {
      for (const m of metadata) {
        const res = await this.update(youtubeOauthClient as OAuth2Client, m)
          .andThen(uploadId => updateLogUploadId(this.logFile, uploadId, m.index));
        res.mapErr(e => {throw e;});
      }
    }
  }

  private async writeSingleVideoMetadata(
    bracketService: BracketService | null,
    keyframeSource: KeyframeSource,
    setList: Readonly<Log>,
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
    setList: Readonly<Log>,
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
    setList: Readonly<Log>,
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

    // TODO: Fetch sets for individual pools instead of the whole phase
    const backetsSets = isValidPhase(setList.phaseId) &&
      await bracketService?.upcomingSetsByPhase(setList.phaseId) ||
      [];
    const phaseGroupNames = (tournament.id && setList.eventId)
      ? await getPhaseGroupNameMapping(tournament.id, setList.eventId, bracketService)
      : EMPTY_PHASE_GROUP_MAPPING;

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
    sets.forEach(set => set.start = set.start ? offsetTimestamp(set.start, phaseStart) : '0:00:00');

    const matchDescs = sets.map((set, i) => {
      const players = set.players;
      if (!Array.isArray(players) || players.length < 2) {
        throw new Error(`No players provided for set ${i+1}`);
      }
      const p1 = players[0].name;
      const p2 = players[1].name;
      const match = set.fullRoundText ? ` (${set.fullRoundText})` : '';
      return `${set.start} - ${p1}${characterList(players[0])} vs ${p2}${characterList(players[1])}${match}`;
    }).join('\n');

    const event = setList.event?.name || mode(setList.sets.map(s => s.state?.event ?? '')) || null;
    const templateData: RawTemplateData = {
      tournament,
      event,
      videogame,
      phase,
      matchDesc: setList.matchDescription || matchDescs,
      commentary: setList.commentary ?? setList.commentators ?? getCommentary(setList.sets) ?? '',
      userData: setList.userData,
    };

    const titleTemplate = await getSingleVideoTitleTemplate();
    const title = setList.title || renderVodTemplate(titleTemplate, templateData);

    const descriptionTemplate = await getSingleVideoTemplate();
    const description = renderVodTemplate(descriptionTemplate, templateData);

    const players = sets.map(s => s.players)
      .reduce((acc, val) => acc.concat(val), []);
    const tags = videoTags(
      tournament,
      videogame,
      phase,
      players,
      setList.excludedTags || [],
      setList.additionalTags || [],
    );

    return {
      index: null,
      sourcePath: setList.file,
      start: setList.start,
      end: setList.end,
      filename: `${this.logName}.mkv`,
      title: sanitizeTitle(title),
      description: sanitizeDescription(description),
      tags,
      uploadId: setList.uploadId ?? null,
    };
  }

  private async perSetMetadata(
    bracketService: BracketService | null,
    setList: Readonly<Log>,
    tournament: VodTournament,
    videogame: VodVideogame,
    phase: VodPhase,
  ): Promise<Metadata[]> {
    // TODO: Fetch sets for individual pools instead of the whole phase
    const bracketSets = isValidPhase(setList.phaseId) &&
      await bracketService?.upcomingSetsByPhase(setList.phaseId) ||
      [];
    const phaseGroupNames = (tournament.id && setList.eventId)
      ? await getPhaseGroupNameMapping(tournament.id, setList.eventId, bracketService)
      : EMPTY_PHASE_GROUP_MAPPING;
    const titleTemplate = await getPerSetTitleTemplate();
    const descriptionTemplate = await getPerSetTemplate();
    const promises = setList.sets.map(async (timestampedSet, index) => {
      if (!timestampedSet.start || !timestampedSet.end) {
        throw new Error(`set ${index} is missing timestamps`);
      }

      const bracketSet = bracketSets.find(s => s.serviceInfo.id === timestampedSet.id);
      const set = getSetData(timestampedSet, bracketSet, phaseGroupNames);
      const players = set.players;

      const fullVsText = `${players[0].name}${characterList(players[0])} vs ${players[1].name}${characterList(players[1])}`;

      const commentary = timestampedSet.commentary ??
        timestampedSet.commentators ??
        setList.commentary ??
        setList.commentators ??
        getCommentary([timestampedSet]) ??
        '';

      const matchDesc = [
        videogame.name,
        phase.name,
        `${set.fullRoundText}:`,
        fullVsText,
      ].filter(nonEmpty).join(' ');

      const event = timestampedSet.state?.event || setList.event?.name || null;

      const templateData: RawTemplateData = {
        tournament,
        event,
        videogame,
        phase,
        matchDesc,
        commentary,
        userData: setList.userData,
        set,
      };
      const title = timestampedSet.title || renderVodTemplate(titleTemplate, templateData);
      const description = renderVodTemplate(descriptionTemplate, templateData);

      const tags = videoTags(
        tournament,
        videogame,
        phase,
        players,
        setList.excludedTags || [],
        [
          ...(players[0].characters?.map(c => c.name) || []),
          ...(players[1].characters?.map(c => c.name) || []),
        ],
      );

      const indexStr = index.toString().padStart(2, '0');
      const playersStr = `${players[0].name}_vs_${players[1].name}`;
      return {
        index,
        sourcePath: setList.file,
        start: timestampedSet.start,
        end: timestampedSet.end,
        filename: filenamify(`${this.logName}_${indexStr}_${playersStr}.mkv`),
        title: sanitizeTitle(title),
        description: sanitizeDescription(description),
        tags,
        uploadId: set.uploadId ?? null,
      };
    });
    return Promise.all(promises);
  }

  private upload(auth: OAuth2Client, m: Metadata): ResultAsync<string, Error> {
    return ResultAsync.fromPromise((async() => {
      if (!auth.credentials['access_token']) {
        throw new Error('No credentials on OAuth client');
      }
      const accessToken = auth.credentials['access_token'];

      checkMetadataSize(m);

      const videoFile = path.join(this.dirName, m.filename);
      const uploadFile = videoFile + '.upload.json';
      try {
        const video = JSON.parse(await fs.readFile(uploadFile, { encoding: 'utf8' })) as youtubeV3.Schema$Video;
        logger.info(`Upload log already found for "${m.filename}"`);
        return video.id as string;
      } catch {
        // File does not exist
        logger.info(`Uploading "${m.filename}"...`);
        const data: youtubeV3.Schema$Video = {
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
        resumable.notifySubscribers = !this.skipNotification;
        const video = await runUpload(resumable);
        logger.info(`Video "${m.filename}" uploaded with id ${video.id}`);
        await fs.writeFile(uploadFile, JSON.stringify(video, null, 2));
        return video.id as string;
      }
    })(), e => e as Error);
  }

  private update(auth: OAuth2Client, m: Metadata): ResultAsync<string, Error> {
    checkMetadataSize(m);

    const videoFile = path.join(this.dirName, m.filename);
    const uploadFile = videoFile + '.upload.json';

    return this.getUploadId(auth, m, uploadFile)
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
      .map(
        video => {
          logger.info(`Video "${video.id}" updated`);
          return video.id as string;
        }
      );
  }

  private getUploadId(
    auth: OAuth2Client,
    m: Metadata,
    uploadFile: string,
  ): ResultAsync<string, Error> {
    if (m.uploadId) {
      return okAsync(m.uploadId);
    }

    // TODO: Test for file presence first
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
        const filenameQuery = titleify(path.basename(m.filename, path.extname(m.filename)));
        const titleQuery = m.title;
        return getVideoByName(auth, filenameQuery)
          .andThen<{ video: youtubeV3.Schema$Video; name: string; }>(video => {
          return video
            ? ok({ video, name: filenameQuery })
            : err(
              new Error(`No video found for query "${filenameQuery}"`)
            );
        })
          .orElse(e => {
            logger.warn(e);
            return getVideoByName(auth, titleQuery)
              .andThen<{ video: youtubeV3.Schema$Video; name: string; }>(video => {
              return video
                ? ok({ video, name: titleQuery })
                : err(
                  new Error(`No video found for query "${titleQuery}"`)
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
      });
  }
}

function getCommentary(sets: Log['sets']): string | undefined {
  return [...new Set(
    sets.flatMap(set => set.state?.commentators?.map(c => getPrefixedAlias(c.person)))
  )].filter(nonEmpty).join(', ');
}

async function loadDatabases(): Promise<void> {
  await loadGameDatabase();
}

async function getKeyframeSource(
  workingDir: string,
  setList: Readonly<Log>,
): Promise<KeyframeSource> {
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
      logger.warn(error);
    });
    resumable.on('fail', function(error: unknown) {
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
  setList: Readonly<Log>,
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

function getTournamentFromState(setList: Readonly<Log>): Pick<Tournament, 'name'> | null {
  const names = setList.sets.map(s => s.state?.tournament).filter(nonEmpty);
  const mostFrequent = mode(names);
  return mostFrequent ? { name: mostFrequent } : null;
}

function getGameFromState(setList: Readonly<Log>): Game | null {
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
  tournamentId: string,
  eventId: string,
  bracketService: BracketService | null,
): Promise<PhaseGroupNameMapping> {
  const tournamentPhaseGroups = await bracketService?.phasesForEvent(tournamentId, eventId)
    .then(t => t.phaseGroups) ||
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
    p.handle,
    p.alias,
  ]);

  const tags = [
    videogame.name,
    videogame.shortName,
    videogame.hashtag,
    ...videogame.additionalTags || [],
    phase.name,
    tournament.shortName,
    ...tournament.additionalTags,
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

function offsetTimestamp(a: Timestamp, b: Timestamp): Timestamp {
  const duration = moment.duration(a).subtract(moment.duration(b));
  // No negative timestamps
  const seconds = Math.max(duration.asSeconds(), 0);
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

function makePrefix(str?: string): string {
  return str && str + ' ' || '';
}

function characterList(player: Set['players'][0]): string {
  if (!player.characters || !player.characters.length) {
    return '';
  }
  return ` (${player.characters.map(c => c.name).join(', ')})`;
}

function updateLogUploadId(
  logFile: string,
  uploadId: string,
  index: number | null,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise((async () => {
    let log: Log = JSON.parse(await fs.readFile(logFile, { encoding: 'utf8' }));
    if (index == null) {
      if (log.uploadId === uploadId) {
        return;
      }

      const uploadIdKey: keyof Log = 'uploadId';
      const keys = Object.keys(log);
      if (keys.indexOf(uploadIdKey) < 0) {
        keys.unshift(uploadIdKey);
      }
      log = {
        uploadId,
        ...log,
      };
      await fs.writeFile(
        logFile,
        JSON.stringify(log, null, 2),
      );
    } else {
      if (log.sets[index].uploadId === uploadId) {
        return;
      }
      log.sets[index] = {
        uploadId,
        ...log.sets[index],
      };
      await fs.writeFile(
        logFile,
        JSON.stringify(log, null, 2),
      );
    }
  })(), e => e as Error);
}
