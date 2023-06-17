import { promises as fs } from 'fs';
import { err, Result, ResultAsync } from 'neverthrow';
import path from 'path';

import { loadGameDatabase } from '@models/games';
import { CURRENT_LOG_FORMAT } from '@server/recording/log';
import BracketServiceProvider from '@services/bracket-service-provider';
import { writeFile } from '@util/fs';
import { getVersion } from '@util/meta';
import { combineAsync } from '@util/results';

import { Log } from './types';

export async function generateLog({
  bracketProvider,
  bracketUrls,
  outputFolder,
  vodFile,
}: {
  bracketProvider: BracketServiceProvider,
  bracketUrls: string[];
  outputFolder: string;
  vodFile: string;
}): Promise<Result<string, Error>> {
  await loadGameDatabase();
  console.log(outputFolder, vodFile);
  const parsedUrls: { serviceName: string, phaseId: string }[] = [];
  for (const url of bracketUrls) {
    const parsed = bracketProvider.parse(url);
    if (!parsed) {
      return err(new Error(`Unable to determine bracket service for URL ${url}`));
    }
    if (!parsed.parsedIds.phaseId) {
      return err(new Error(`Unable to get specific bracket from URL ${url}`));
    }
    parsedUrls.push({
      serviceName: parsed.serviceName,
      phaseId: parsed.parsedIds.phaseId,
    });
  }
  const uniqueServices = new Set(parsedUrls.map(p => p.serviceName));
  if (uniqueServices.size === 0) {
    return err(new Error('At least one bracket URL must be provided'));
  }
  if (uniqueServices.size > 1) {
    return err(new Error('All bracket URLs must be from the same service'));
  }
  const serviceName = parsedUrls[0].serviceName;
  // Will things explode if we include sets from multiple brackets?
  const phaseId = parsedUrls[0].phaseId;
  const service = bracketProvider.get(serviceName);
  const eventIdRes = await ResultAsync.fromPromise(
    service.eventIdForPhase(phaseId),
    e => e as Error,
  );
  if (eventIdRes.isErr()) {
    return eventIdRes.map(() => '');
  }
  const eventId = eventIdRes.value;

  const sets = await combineAsync(parsedUrls.map(parsed =>
    ResultAsync.fromPromise(
      service.upcomingSetsByPhase(parsed.phaseId),
      e => e as Error,
    ),
  ));
  if (sets.isErr()) {
    return sets.map(() => '');
  }
  const sortedSets = sets.value.flat()
    .sort((a, b) =>
      (a.completedAt || Number.MAX_SAFE_INTEGER) - (b.completedAt || Number.MAX_SAFE_INTEGER));
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

  const infoRes = await ResultAsync.fromPromise(
    service.eventInfo(eventId),
    e => e as Error,
  );
  if (infoRes.isErr()) {
    return infoRes.map(() => '');
  }
  console.log(infoRes.value);
  const gameId = infoRes.value.videogame.id || 'log';

  const filename = `${gameId}-${serviceName}_${phaseId}.json`;
  const file = path.join(outputFolder, filename);
  return await ResultAsync.fromPromise(
    fs.mkdir(outputFolder, { recursive: true }),
    e => e as Error,
  ).andThen(() =>
    writeFile(
      file,
      JSON.stringify(log, null, 2),
    ).map(() => file)
  );
}
