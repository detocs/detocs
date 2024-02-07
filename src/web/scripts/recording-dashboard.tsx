import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { useEffect, useRef, StateUpdater } from 'preact/hooks';

import { Timestamp } from '@models/timestamp';
import { State as ClipState, isImageClipView, getClipById } from '@server/clip/state';
import ServerState, { Recording } from '@server/recording/state';
import { checkResponseStatus } from '@util/ajax';
import { Id } from '@util/id';
import { AssignedGroup, groupRecordings, isAssignedGroup, mostRecent, UnassignedGroup } from '@util/recording';
import { fromMillis, toMillis } from '@util/timestamp';

import { recordingEndpoint } from './api';
import { useStartTimestamp, useStopTimestamp, useRecording, useRecordingGroup, useGroupStartTimestamp, useGroupStopTimestamp } from './hooks/recording';
import { logError } from './log';
import { Thumbnail } from './thumbnail';
import { TimestampInput } from './timestamp';
import { ClipSelectorModal } from './clip-selector';

interface Props {
  state: ServerState;
  updateState: StateUpdater<ServerState>;
  clipState: ClipState;
}

const startEndpoint = recordingEndpoint('/start').href;
const stopEndpoint = recordingEndpoint('/stop').href;
const updateEndpoint = recordingEndpoint('/update').href;
const cutEndpoint = recordingEndpoint('/cut').href;
const startGroupEndpoint = recordingEndpoint('/startGroup').href;
const stopGroupEndpoint = recordingEndpoint('/endGroup').href;
const updateGroupEndpoint = recordingEndpoint('/updateGroup').href;

function start(): void {
  fetch(startEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .catch(logError);
}

function stop(): void {
  fetch(stopEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .catch(logError);
}

function startGroup(): void {
  fetch(startGroupEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .catch(logError);
}

function stopGroup(): void {
  fetch(stopGroupEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .catch(logError);
}

function updateGroupThumbnail(id: Id, timestamp: Timestamp|null): void {
  fetch(updateGroupEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'id': id, 'thumbnail-timestamp': timestamp }),
  })
    .then(checkResponseStatus)
    .catch(logError);
}

const RecordingDashboard: FunctionalComponent<Props> = ({
  state,
  updateState,
  clipState,
}): VNode => {
  const latestRecording = mostRecent(state.recordings);
  const isRecordingSet = !!latestRecording &&
    (!!latestRecording.startTimestamp && !latestRecording.stopTimestamp);
  const latestGroup = mostRecent(state.recordingGroups);
  const isRecordingGroup = !!latestGroup &&
    (!!latestGroup.startTimestamp && !latestGroup.stopTimestamp);

  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    let tabElement = ref.current?.closest('.tabbable-section');
    tabElement = tabElement && tabElement.querySelector('.tabbable-section__tab label');
    if (!tabElement) {
      return;
    }
    tabElement.classList.toggle('recording__tab-label--recording', isRecordingSet);
  });

  const groups = groupRecordings(state);

  return (
    <Fragment>
      <div class="action-row">
        <button type="button" onClick={startGroup}>Start Group</button>
        <button type="button" onClick={stopGroup} disabled={!isRecordingGroup}>End Group</button>
      </div>
      <div class="action-row">
        <button type="button" onClick={start}>Start Set</button>
        <button type="button" onClick={stop} disabled={!isRecordingSet}>End Set</button>
      </div>
      <ol ref={ref} class="recording__list">
        {groups.map(g => isAssignedGroup(g)
          ? <EditableGroup group={g} state={state} updateState={updateState} clipState={clipState}/>
          : <ImplicitGroup group={g} state={state} updateState={updateState} />
        ).reverse()}
      </ol>
    </Fragment>
  );
};
export default RecordingDashboard;

function EditableGroup({
  group,
  state,
  updateState,
  clipState,
}: {
  group: AssignedGroup;
  state: ServerState;
  updateState: StateUpdater<ServerState>;
  clipState: ClipState;
}): VNode {
  const [recordingGroup, updateGroup] = useRecordingGroup(state, updateState, group.id);
  const [startTimestamp, updateStart] = useGroupStartTimestamp(recordingGroup, updateGroup);
  const [stopTimestamp, updateStop] = useGroupStopTimestamp(recordingGroup, updateGroup);
  const validClips = clipState.clips.filter(isImageClipView)
    .filter(c => c.clip.recordingTimestampMs);
  const thumbnailTimestampMs = group.vodThumbnailTimestamp
    ? toMillis(group.vodThumbnailTimestamp)
    : null;
  // NOTE: This technically won't work properly atm since Clips don't include
  // recording file info, but the odds of timestamps being identical down to the
  // millisecond are pretty slim.
  const thumbnailClip = thumbnailTimestampMs != null ?
    validClips.find(c => c.clip.recordingTimestampMs === thumbnailTimestampMs) : null;
  const thumbnailEditor = <fieldset class="recording__thumbnail">
    <legend>Group Thumbnail</legend>
    <div>
      <Thumbnail media={thumbnailClip?.clip.media} />
      <ClipSelectorModal
        clips={validClips}
        onSelect={id => {
          const clip = getClipById(clipState, id);
          const ts = clip?.clip.recordingTimestampMs;
          if (ts) {
            updateGroupThumbnail(group.id, fromMillis(ts));
          } else {
            updateGroupThumbnail(group.id, null);
          }
        }}
        currentClipId={thumbnailClip?.clip.id}
      >
        Select Thumbnail
      </ClipSelectorModal>
    </div>
  </fieldset>;
  return (
    <li class="recording__group">
      {stopTimestamp &&
        <form
          method="post"
          action={updateGroupEndpoint}
          class="recording__editor"
          autocomplete="off"
        >
          <input type="hidden" name="id" value={recordingGroup.id} />
          {thumbnailEditor}
          <fieldset class="recording__boundary recording__group-boundary">
            <legend>Group End</legend>
            <div>
              <Thumbnail media={recordingGroup.stopThumbnail} />
              <div class="recording__group-metadata-and-controls">
                <div>
                  {recordingGroup.streamRecordingFile}
                </div>
                <div class="recording__group-controls">
                  <TimestampInput
                    name="stop-timestamp"
                    value={stopTimestamp}
                    updater={updateStop}
                  />
                  <button type="submit">Update</button>
                </div>
              </div>
            </div>
          </fieldset>
        </form>
      }
      {group.recordings.length > 0 && <ol>
        {group.recordings.map(r =>
          <Recording key={r.id} recordingId={r.id} state={state} updateState={updateState} />
        ).reverse()}
      </ol>}
      <form
        method="post"
        action={updateGroupEndpoint}
        class="recording__editor"
        autocomplete="off"
      >
        <input type="hidden" name="id" value={recordingGroup.id} />
        {thumbnailEditor}
        <fieldset class="recording__boundary recording__group-boundary">
          <legend>Group Start</legend>
          <div>
            <Thumbnail media={recordingGroup.startThumbnail} />
            <div class="recording__group-metadata-and-controls">
              <div>
                {recordingGroup.streamRecordingFile}
              </div>
              <div class="recording__group-controls">
                <TimestampInput
                  name="start-timestamp"
                  value={startTimestamp}
                  updater={updateStart}
                />
                <button type="submit">Update</button>
              </div>
            </div>
          </div>
        </fieldset>
      </form>
    </li>
  );
}

function ImplicitGroup({
  group,
  state,
  updateState,
}: {
  group: UnassignedGroup;
  state: ServerState;
  updateState: StateUpdater<ServerState>;
}): VNode|null {
  if (group.recordings.length === 0) {
    return null;
  }
  return (
    <Fragment>
      {group.recordings.map(r =>
        <Recording key={r.id} recordingId={r.id} state={state} updateState={updateState} />
      ).reverse()}
    </Fragment>
  );
}

interface RecordingProps {
  state: ServerState;
  updateState: StateUpdater<ServerState>;
  recordingId: Id,
}

function Recording({ state, updateState, recordingId }: RecordingProps): VNode {
  const [recording, updateRecording] = useRecording(state, updateState, recordingId);
  const [startTimestamp, updateStart] = useStartTimestamp(recording, updateRecording);
  const [stopTimestamp, updateStop] = useStopTimestamp(recording, updateRecording);
  const isCut = !!recording.recordingFile;
  const canCut = startTimestamp && stopTimestamp && !isCut;
  // TODO: Prevent saving if start > stop
  // TODO: Recut recordings
  // TODO: Loading spinner
  return (
    <li class="recording__list-item">
      <fieldset class="recording__block" disabled={isCut}>
        {recording.displayName && <legend>{recording.displayName}</legend>}
        <form
          method="post"
          action={updateEndpoint}
          class="recording__editor"
          autocomplete="off"
        >
          <input type="hidden" name="id" value={recording.id} />
          <fieldset class="recording__boundary">
            <legend>Start</legend>
            <div>
              <Thumbnail
                media={recording.startThumbnail} />
              <TimestampInput
                name="start-timestamp"
                value={startTimestamp}
                updater={updateStart}
              />
            </div>
          </fieldset>
          <span className="recording__controls">
            <button type="submit">Update</button>
            <button type="submit" formAction={cutEndpoint} disabled={!canCut}>Cut</button>
          </span>
          <fieldset class="recording__boundary">
            <legend>End</legend>
            <div>
              <Thumbnail
                media={recording.stopThumbnail} />
              <TimestampInput
                name="stop-timestamp"
                value={stopTimestamp}
                updater={updateStop}
              />
            </div>
          </fieldset>
        </form>
        {recording.recordingFile && <div class="recording__file">{recording.recordingFile}</div>}
      </fieldset>
    </li>
  );
}
