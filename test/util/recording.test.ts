import { Recording, RecordingGroup } from '@server/recording/state';
import { getId, Id } from '@util/id';
import { Group, groupRecordings, isAssignedGroup } from '@util/recording';

describe(groupRecordings, () => {
  it('puts recordings in an unassigned group', () => {
    const
      r1 = getId(),
      r2 = getId(),
      r3 = getId();
    const groups = groupRecordings({
      recordings: [
        recording({ id: r1, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:01:00', stopTimestamp: '00:02:00' }),
        recording({ id: r2, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:03:00', stopTimestamp: '00:04:00' }),
        recording({ id: r3, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:05:00', stopTimestamp: '00:06:00' }),
      ],
      recordingGroups: [],
    });

    expect(groups.map(summarize)).toEqual<GroupSummary[]>([
      { startMillis: 0, stopMillis: null, streamRecordingFile: 'vid1.mp4', recordings: [r1, r2, r3] },
    ]);
  });

  it('creates unassigned groups between assigned groups', () => {
    const
      r01 = getId(),
      r02 = getId(),
      g1 = getId(),
      r03 = getId(),
      r04 = getId(),
      r05 = getId(),
      r06 = getId(),
      g2 = getId(),
      r07 = getId(),
      r08 = getId(),
      r09 = getId(),
      r10 = getId();
    const groups = groupRecordings({
      recordings: [
        recording({ id: r01, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:01:00', stopTimestamp: '00:02:00' }),
        recording({ id: r02, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:03:00', stopTimestamp: '00:04:00' }),
        recording({ id: r03, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:05:00', stopTimestamp: '00:06:00' }),
        recording({ id: r04, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:07:00', stopTimestamp: '00:08:00' }),
        recording({ id: r05, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:09:00', stopTimestamp: '00:10:00' }),
        recording({ id: r06, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:11:00', stopTimestamp: '00:12:00' }),
        recording({ id: r07, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:13:00', stopTimestamp: '00:14:00' }),
        recording({ id: r08, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:15:00', stopTimestamp: '00:16:00' }),
        recording({ id: r09, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:17:00', stopTimestamp: '00:18:00' }),
        recording({ id: r10, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:19:00', stopTimestamp: '00:20:00' }),
      ],
      recordingGroups: [
        recordingGroup({ id: g1, startTimestamp: '00:04:30', stopTimestamp: '00:08:30', streamRecordingFile: 'vid1.mp4' }),
        recordingGroup({ id: g2, startTimestamp: '00:12:30', stopTimestamp: '00:16:30', streamRecordingFile: 'vid1.mp4' }),
      ],
    });

    expect(groups.map(summarize)).toEqual<GroupSummary[]>([
      { startMillis: 0, stopMillis: null, streamRecordingFile: 'vid1.mp4', recordings: [r01, r02] },
      { startMillis: 270000, stopMillis: 510000, streamRecordingFile: 'vid1.mp4', recordings: [r03, r04], id: g1 },
      { startMillis: 510000, stopMillis: null, streamRecordingFile: 'vid1.mp4', recordings: [r05, r06] },
      { startMillis: 750000, stopMillis: 990000, streamRecordingFile: 'vid1.mp4', recordings: [r07, r08], id: g2 },
      { startMillis: 990000, stopMillis: null, streamRecordingFile: 'vid1.mp4', recordings: [r09, r10] },
    ]);
  });

  it('creates separate groups for each file', () => {
    const
      r01 = getId(),
      r02 = getId(),
      g1 = getId(),
      r03 = getId(),
      r04 = getId(),
      r05 = getId(),
      r06 = getId();
    const groups = groupRecordings({
      recordings: [
        recording({ id: r01, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:01:00', stopTimestamp: '00:02:00' }),
        recording({ id: r02, streamRecordingFile: 'vid1.mp4', startTimestamp: '00:03:00', stopTimestamp: '00:04:00' }),
        recording({ id: r03, streamRecordingFile: 'vid2.mp4', startTimestamp: '00:05:00', stopTimestamp: '00:06:00' }),
        recording({ id: r04, streamRecordingFile: 'vid2.mp4', startTimestamp: '00:07:00', stopTimestamp: '00:08:00' }),
        recording({ id: r05, streamRecordingFile: 'vid3.mp4', startTimestamp: '00:09:00', stopTimestamp: '00:10:00' }),
        recording({ id: r06, streamRecordingFile: 'vid3.mp4', startTimestamp: '00:11:00', stopTimestamp: '00:12:00' }),
      ],
      recordingGroups: [
        recordingGroup({ id: g1, startTimestamp: '00:04:30', stopTimestamp: null, streamRecordingFile: 'vid2.mp4' }),
      ],
    });

    expect(groups.map(summarize)).toEqual<GroupSummary[]>([
      { startMillis: 0, stopMillis: null, streamRecordingFile: 'vid1.mp4', recordings: [r01, r02] },
      { startMillis: 0, stopMillis: null, streamRecordingFile: 'vid2.mp4', recordings: [] },
      { startMillis: 270000, stopMillis: null, streamRecordingFile: 'vid2.mp4', recordings: [r03, r04], id: g1 },
      { startMillis: 0, stopMillis: null, streamRecordingFile: 'vid3.mp4', recordings: [r05, r06] },
    ]);
  });
});

interface GroupSummary {
  id?: Id;
  startMillis: number;
  stopMillis: number | null;
  streamRecordingFile: string;
  recordings: Id[];
}

function summarize(group: Group): GroupSummary {
  const summary: GroupSummary = {
    startMillis: group.startMillis,
    stopMillis: group.stopMillis,
    streamRecordingFile: group.streamRecordingFile,
    recordings: group.recordings.map(r => r.id),
  };
  if (isAssignedGroup(group)) {
    summary.id = group.id;
  }
  return summary;
}

function recording(
  partial: Partial<Recording> & Pick<Recording, 'id'|'streamRecordingFile'|'startTimestamp'>,
): Recording {
  const nullRecording: Omit<Recording, 'id'|'streamRecordingFile'|'startTimestamp'> = {
    recordingFile: null,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
    vodThumbnailTimestamp: null,
    displayName: '',
    metadata: null,
  };
  return Object.assign(
    {},
    nullRecording,
    partial,
  );
}


function recordingGroup(
  partial: Partial<RecordingGroup> & Pick<RecordingGroup, 'id'|'streamRecordingFile'|'startTimestamp'>,
): RecordingGroup {
  const nullRecordingGroup: Omit<RecordingGroup, 'id'|'streamRecordingFile'|'startTimestamp'> = {
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
    vodThumbnailTimestamp: null,
  };
  return Object.assign(
    {},
    nullRecordingGroup,
    partial,
  );
}

