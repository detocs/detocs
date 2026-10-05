import { err, errAsync, ok, okAsync, ResultAsync, safeTry } from 'neverthrow';
import semverLt from 'semver/functions/lt';

import ObsLegacyClient from '@services/obs-legacy/obs.ts';
import ObsClient from '@services/obs/obs.ts';
import VisionMixer from '@services/vision-mixer-service.ts';
import { sleep } from '@util/async.ts';
import { getVideoStats } from '@util/ffmpeg.ts';
import { getLogger } from '@util/logger.ts';
import { fromMillis, toMillis } from '@util/timestamp.ts';

const logger = getLogger('calibrate-timestamps');
const HYBRID_MP4_FORMAT = 'hybrid_mp4';
const CHAPTER_NAME = 'latency-test-marker';
const ENCODING_WAIT_TIME_MS = 5000; // Max reasonable encoder delay

export function calibrateTimestamps(
  visionMixer: VisionMixer,
): ResultAsync<void, Error> {
  if (!(visionMixer instanceof ObsClient || visionMixer instanceof ObsLegacyClient)) {
    return errAsync(new Error(`${visionMixer.name()} is not supported for timestamp calibration`));
  }
  if (visionMixer instanceof ObsLegacyClient) {
    return errAsync(new Error('Timestamp calibration is not supported with obs-websocket 4.x'));
  }
  return calibrateObsTimestamps(visionMixer);
}
function calibrateObsTimestamps(
  obs: ObsClient,
): ResultAsync<void, Error> {
  return obs.connect()
    .map(() => obs)
    .andThen(checkObsVersion)
    .andThen(obs => setHybridMp4Recording(
      obs,
      obs => recordVideoWithChapterMarker(obs)
        .andThen(calculateEncodingLatency)
        .andThen(setProfileEncodingLatency)
    ))
    .map(() => undefined);
}

function checkObsVersion(obs: ObsClient): ResultAsync<ObsClient, Error> {
  return obs.getVersion()
    .andThen(version => {
      if (semverLt(version, '30.2.0')) {
        return errAsync(new Error('Timestamp calibration requires OBS Studio 30.2 or later'));
      }
      return okAsync(obs);
    });
}

function setHybridMp4Recording(
  obs: ObsClient,
  fn: (obs: ObsClient) => ResultAsync<ObsClient, Error>,
): ResultAsync<ObsClient, Error> {
  return obs.getRecordingFormat()
    .andThen(origFormat => {
      if (origFormat !== HYBRID_MP4_FORMAT) {
        logger.info('Temporarily setting recording format to Hybrid MP4');
        return obs.setRecordingFormat(HYBRID_MP4_FORMAT).map(() => obs)
          .andThen(fn)
          .andThen(obs => obs.setRecordingFormat(origFormat).map(() => obs))
          .orElse(error => obs.setRecordingFormat(origFormat)
            .mapErr(error2 => new Error(`Failed to restore original recording format: ${error2.message}; original error: ${error.message}`))
            .andThen(() => err(error))
          );
      } else {
        return fn(obs);
      }
    });
}

function recordVideoWithChapterMarker(
  obs: ObsClient,
): ResultAsync<{ obs: ObsClient, obsTimestampMs: number, recordingFile: string }, Error> {
  return safeTry<{
    obs: ObsClient,
    obsTimestampMs: number,
    recordingFile: string
  }, Error>(async function*() {
    logger.debug('Starting OBS recording');
    yield* await obs.startRecording();

    await sleep(ENCODING_WAIT_TIME_MS);

    const recordingFile = yield* await obs.getRecordingFile();
    if (!recordingFile) {
      return err(new Error('Unable to start OBS recording'));
    }

    logger.debug('Adding chapter marker to OBS recording');
    const recordingTimestamp = yield* await obs.addRecordingChapterMarker(CHAPTER_NAME);
    if (!recordingTimestamp) {
      return err(new Error('Unable to get recording timestamp from OBS'));
    }
    logger.debug(`Recording timestamp from obs-websocket: ${recordingTimestamp}`);

    await sleep(ENCODING_WAIT_TIME_MS);

    logger.debug('Stopping OBS recording');
    yield* await obs.stopRecording();

    await sleep(ENCODING_WAIT_TIME_MS);

    return ok({
      obs,
      obsTimestampMs: toMillis(recordingTimestamp),
      recordingFile,
    });
  });
}

function calculateEncodingLatency({
  obs,
  obsTimestampMs,
  recordingFile,
}: {
  obs: ObsClient,
  obsTimestampMs: number,
  recordingFile: string,
}): ResultAsync<{ obs: ObsClient, latencyMs: number }, Error> {
  return ResultAsync.fromPromise((async () => {
    const stats = await getVideoStats(recordingFile);
    const chapter = stats.chapters.find(ch => ch.title === CHAPTER_NAME);
    if (!chapter) {
      throw new Error(`No chapter found in recording file ${recordingFile}`);
    }
    logger.debug(`Chapter timestamp from recording file: ${fromMillis(chapter.startMs)}`);
    if (chapter.startMs < obsTimestampMs) {
      throw new Error('Encoding test measured negative latency');
    }
    const latencyMs = chapter.startMs - obsTimestampMs;
    logger.info(`Calculated encoding latency: ${latencyMs} ms`);
    return {
      obs,
      latencyMs,
    };
  })(), err => err as Error);
}

function setProfileEncodingLatency({
  obs,
  latencyMs,
}: {
  obs: ObsClient,
  latencyMs: number,
}): ResultAsync<ObsClient, Error> {
  logger.info('Saving encoding latency to OBS profile');
  return obs.setEncodingLatency(latencyMs)
    .map(() => obs);
}
