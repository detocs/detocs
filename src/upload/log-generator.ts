import { promises as fs } from 'fs';
import { errAsync, ResultAsync } from 'neverthrow';
import path from 'path';

import TournamentSet from '@models/tournament-set.ts';
import { CURRENT_LOG_FORMAT } from '@server/recording/log.ts';
import BracketServiceProvider from '@services/bracket-service-provider.ts';
import { writeFile } from '@util/fs.ts';
import { getLogger } from '@util/logger.ts';
import { getVersion } from '@util/meta.ts';
import { combineAsync } from '@util/results.ts';

import { Log } from './types.ts';

const logger = getLogger('upload/log-generator');

export function generateLog({
  bracketProvider,
  bracketUrls,
  outputFolder,
  vodFile,
}: {
  bracketProvider: BracketServiceProvider,
  bracketUrls: string[];
  outputFolder: string;
  vodFile: string;
}): ResultAsync<string, Error> {
  console.log(outputFolder, vodFile);
  const parsedUrls: { serviceName: string, phaseId: string }[] = [];
  for (const url of bracketUrls) {
    const parsed = bracketProvider.parse(url);
    if (!parsed) {
      return errAsync(new Error(`Unable to determine bracket service for URL ${url}`));
    }
    if (!parsed.parsedIds.phaseId) {
      return errAsync(new Error(`Unable to get specific bracket from URL ${url}`));
    }
    parsedUrls.push({
      serviceName: parsed.serviceName,
      phaseId: parsed.parsedIds.phaseId,
    });
  }
  const uniqueServices = new Set(parsedUrls.map(p => p.serviceName));
  if (uniqueServices.size === 0) {
    return errAsync(new Error('At least one bracket URL must be provided'));
  }
  if (uniqueServices.size > 1) {
    return errAsync(new Error('All bracket URLs must be from the same service'));
  }
  const serviceName = parsedUrls[0].serviceName;
  // Will things explode if we include sets from multiple brackets?
  const phaseId = parsedUrls[0].phaseId;
  const service = bracketProvider.get(serviceName);
  return ResultAsync.fromPromise(
    service.eventIdForPhase(phaseId),
    e => e as Error,
  )
    .andThen(eventId =>
      combineAsync(parsedUrls.map(parsed =>
        ResultAsync.fromPromise(
          service.upcomingSetsByPhase(parsed.phaseId),
          e => e as Error,
        ),
      ))
        .map(sets => sets.flat().sort(byCompletionTime))
        .map(sortedSets => ({ eventId, sortedSets }))
    )
    .andThen(({ eventId, sortedSets }) => {
      const log: Log & { file?: string } = {
        format: CURRENT_LOG_FORMAT,
        version: getVersion(),
        file: vodFile && path.relative(outputFolder, vodFile),
        bracketService: serviceName,
        eventId: eventId,
        phaseId: phaseId,
        start: '00:00:00',
        end: '00:00:00',
        sets: sortedSets.map(s => ({
          id: s.serviceInfo.id,
          displayName: s.displayName,
          start: '00:00:00',
          end: '00:00:00',
        })),
      };
      return ResultAsync.fromPromise(
        service.eventInfo(eventId),
        e => e as Error,
      )
        .map(info => { logger.debug(info); return info; })
        .map(info => ({ log, info }));
    })
    .andThen(({ log, info }) => {
      const gameId = info.videogame.id || 'log';
      const filename = `${gameId}-${serviceName}_${phaseId}.json`;
      const file = path.join(outputFolder, filename);
      return ResultAsync.fromPromise(
        fs.mkdir(outputFolder, { recursive: true }),
        e => e as Error,
      ).andThen(() =>
        writeFile(
          file,
          JSON.stringify(log, null, 2),
        ).map(() => file)
      );
    });
}

function byCompletionTime(a: TournamentSet, b: TournamentSet): number {
  return (a.completedAt || Number.MAX_SAFE_INTEGER) - (b.completedAt || Number.MAX_SAFE_INTEGER);
}
