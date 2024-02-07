import findLastIndex from 'lodash.findlastindex';

import State, { Recording, RecordingGroup } from '@server/recording/state';
import { compareStr } from '@util/string';
import { toMillis } from '@util/timestamp';

export interface AssignedGroup extends RecordingGroup {
  startMillis: number;
  stopMillis: number | null;
  recordings: Recording[];
}

export interface UnassignedGroup extends Pick<RecordingGroup, 'streamRecordingFile'> {
  startMillis: number;
  stopMillis: null;
  recordings: Recording[];
}

export type Group = AssignedGroup | UnassignedGroup;

export function isAssignedGroup(
  rg: Group,
): rg is AssignedGroup {
  return !!(rg as Partial<AssignedGroup>).id;
}

export function groupRecordings({ recordings, recordingGroups }: State): Group[] {
  const orderedFiles = [
    ...recordingGroups.map(rg => ({ id: rg.id, file: rg.streamRecordingFile })),
    ...recordings.map(r => ({ id: r.id, file: r.streamRecordingFile })),
  ].sort((a, b) => compareStr(a.id, b.id))
    .map(x => x.file);
  const files = [...new Set(orderedFiles)];

  const groups: Group[] = files.map(f => ({
    streamRecordingFile: f,
    startMillis: 0,
    stopMillis: null,
    recordings: [],
  }));
  for (const rg of recordingGroups) {
    const index = findLastIndex(groups, g => g.streamRecordingFile === rg.streamRecordingFile);
    if (index === -1) {
      continue;
    }

    const stopMillis = (rg.stopTimestamp != null) ? toMillis(rg.stopTimestamp) : null;
    groups.splice(index+1, 0, Object.assign({}, rg, {
      startMillis: toMillis(rg.startTimestamp),
      stopMillis: stopMillis,
      recordings: [],
    }));
    if (stopMillis) {
      groups.splice(index+2, 0, {
        streamRecordingFile: rg.streamRecordingFile,
        startMillis: stopMillis,
        stopMillis: null,
        recordings: [],
      });
    }
  }

  const reversedGroups = groups.slice().reverse();
  for (const r of recordings) {
    const recStartMillis = toMillis(r.startTimestamp);
    if (r.stopTimestamp) {
      const recStopMillis = toMillis(r.stopTimestamp);
      const group = reversedGroups.find(g => (
        g.streamRecordingFile === r.streamRecordingFile
        && g.stopMillis != null
        && recStartMillis >= g.startMillis
        && recStopMillis <= g.stopMillis
      )) || reversedGroups.find(g => (
        g.streamRecordingFile === r.streamRecordingFile
        && recStartMillis >= g.startMillis
      ));
      group && group.recordings.push(r);
    } else {
      const group = reversedGroups.find(g => (
        g.streamRecordingFile === r.streamRecordingFile
        && recStartMillis >= g.startMillis
      ));
      group && group.recordings.push(r);
    }
  }
  return groups;
}

export function mostRecent<T>(list: T[]): T|undefined {
  return list[list.length-1];
}
