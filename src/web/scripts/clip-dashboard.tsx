import debounce from 'lodash.debounce';
import { h, FunctionalComponent, Fragment, VNode } from 'preact';
import { StateUpdater, useRef, useState, Ref, useEffect } from 'preact/hooks';

import { ImageClip, VideoClip, isVideoClip, Clip } from '@models/media';
import { Timestamp } from '@models/timestamp';
import { GetClipResponse } from '@server/clip/server';
import {
  State,
  ClipView,
  ClipStatus,
  isImageClipView,
  isVideoClipView,
} from '@server/clip/state';
import { checkResponseStatus } from '@util/ajax';
import { inputHandler } from '@util/dom';
import { Id } from '@util/id';
import { fromMillis } from '@util/timestamp';

import { clipEndpoint } from './api';
import { ClipSelector } from './clip-selector';
import { useLocalState } from './hooks/local-state';
import { logError } from './log';
import { SceneScreenshotMenu } from './screenshot-menu';

interface Props {
  state: State;
  updateState: StateUpdater<State>;
  recentScenes: string[];
  addRecentScene: (scene: string) => void;
}

interface ImageViewerProps {
  clipView: ClipView<ImageClip>;
}

type VideoEditorProps = VideoClip & Omit<ClipView, 'clip'> & {
  updateStartMs: StateUpdater<number>;
  updateEndMs: StateUpdater<number>;
  updateDescription: StateUpdater<string>;
  autoplay: boolean;
  mediaSourceSelector: VNode|null;
};

/**
 * When changing the end timestamp of a clip, this determines how much earlier
 * in the video we start playback for previewing
 */
const CLIP_END_PLAYBACK_OFFSET_MS = 2000;

/**
 * So that we don't have to adjust 1ms at a time
 */
const CLIP_RANGE_STEP_MS = 250;

/**
 * Limits the rate at which values get updated while dragging range sliders
 */
const EDITOR_DEBOUNCE_TIME = 100;

const updateEndpoint = clipEndpoint('/update').href;
const cutEndpoint = clipEndpoint('/cut').href;
const sendEndpoint = clipEndpoint('/send').href;
const clipEndpoints = [
  { displayName: '5s', callback: clipEndpointForDuration(5) },
  { displayName: '10s', callback: clipEndpointForDuration(10) },
  { displayName: '15s', callback: clipEndpointForDuration(15) },
  { displayName: '20s', callback: clipEndpointForDuration(20) },
  { displayName: '30s', callback: clipEndpointForDuration(30) },
  { displayName: '45s', callback: clipEndpointForDuration(45) },
  { displayName: '60s', callback: clipEndpointForDuration(60) },
];

function clipEndpointForDuration(seconds: number): () => Promise<Id> {
  const endpoint = clipEndpoint('/clip');
  endpoint.searchParams.set('seconds', seconds.toString());
  const href = endpoint.href;
  return () => fetch(href, { method: 'POST' })
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<GetClipResponse>)
    .then(resp => resp.id);
}

const ClipMetadata: FunctionalComponent<Clip> = (clip) => {
  const recTs = formatTimestampRange(clip, clip.recordingTimestampMs);
  const streamTs = formatTimestampRange(clip, clip.streamTimestampMs);
  return (
    <p class="clips__metadata">
      ID: {clip.id}
      {recTs && <Fragment><br />Recording: {recTs}</Fragment>}
      {streamTs && <Fragment><br />Stream: {streamTs}</Fragment>}
    </p>
  );
};

const ImageViewer: FunctionalComponent<ImageViewerProps> = ({ clipView }) => {
  return (
    <div class="image-viewer">
      <div class="image-viewer__image">
        <img src={clipView.clip.media.url} />
      </div>
      <ClipMetadata {...clipView.clip}/>
    </div>
  );
};

const VideoEditor: FunctionalComponent<VideoEditorProps> = (props) => {
  const {
    id,
    media,
    waveform,
    status,
    clipStartMs: startMs,
    updateStartMs,
    clipEndMs: endMs,
    updateEndMs,
    description,
    updateDescription,
    autoplay,
    mediaSourceSelector,
  } = props;
  const isRendering = status === ClipStatus.Rendering;
  const isRendered = status === ClipStatus.Rendered;
  const durationMs = media.durationMs;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [ currentTime, updateCurrentTime ] = useState(0);
  const startMaximum = endMs;
  const startRangePercentage = `${startMaximum / durationMs * 100}%`;
  const endMinimum = quantizedCeilFromEnd(startMs, durationMs, CLIP_RANGE_STEP_MS);
  const endRangePercentage = `${(durationMs - endMinimum) / durationMs * 100}%`;
  useEffect(() => {
    if (status === ClipStatus.Rendering && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.muted = true;
    }
  }, [ status ]);

  const prevTimestamp = useRef(startMs);
  const handleTimeUpdate = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    const timestamp = video.currentTime * 1000;
    updateCurrentTime(timestamp);

    // Loop selected range
    if (prevTimestamp.current != timestamp &&
      prevTimestamp.current < endMs &&
      (timestamp > endMs || timestamp === 0))
    {
      video.currentTime = startMs / 1000;
    }
    prevTimestamp.current = timestamp;
  };
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = startMs / 1000;
    }
  // We only want this to happen on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playbackUpdater = (timestampMs: number): void => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.currentTime = timestampMs / 1000;
    prevTimestamp.current = timestampMs;
    updateCurrentTime(timestampMs);
  };

  const rangeStartUpdater = debounce(
    rangeUpdateHandler(videoRef, updateStartMs, playbackUpdater),
    EDITOR_DEBOUNCE_TIME,
  );

  const playbackPositionUpdater = debounce(
    playbackUpdateHandler(videoRef, playbackUpdater),
    EDITOR_DEBOUNCE_TIME);

  const rangeEndUpdater = debounce(
    rangeUpdateHandler(
      videoRef,
      updateEndMs,
      playbackUpdater,
      CLIP_END_PLAYBACK_OFFSET_MS,
      startMs,
    ),
    EDITOR_DEBOUNCE_TIME,
  );

  return (
    <form
      method="post"
      action={updateEndpoint}
      class="video-editor"
      autocomplete="off"
    >
      <div class="video-editor__trimmer" aria-busy={status === ClipStatus.Rendering}>
        <video
          class="video-editor__video"
          ref={videoRef}
          src={media.url}
          onTimeUpdate={handleTimeUpdate}
          autoPlay={autoplay && !isRendering}
          preload={'metadata'}
          controls={true}
          loop={true}
          muted={true}
        >
        </video>
        <div class="video-editor__range">
          <img class="video-editor__waveform" src={waveform.url} />
          <progress
            class="video-editor__progress"
            max={durationMs}
            value={Math.trunc(currentTime)}
          >
          </progress>
          {!isRendered && <div
            class="video-editor__range-outline"
            style={`left: ${startMs/durationMs*100}%;` +
            `right: ${(durationMs - endMs)/durationMs*100}%;`}
          >
          </div>}
          {!isRendered && <input
            type="range"
            name="startMs"
            class="video-editor__range-bound video-editor__range-start"
            style={`--range-width: ${startRangePercentage}`}
            min={0}
            max={startMaximum}
            step={CLIP_RANGE_STEP_MS}
            value={startMs}
            disabled={isRendering}
            onInput={rangeStartUpdater}
            onChange={rangeStartUpdater}
          />}
          <input
            type="range"
            class="video-editor__playback-cursor"
            min={0}
            max={durationMs}
            step={CLIP_RANGE_STEP_MS}
            value={Math.trunc(currentTime)}
            disabled={isRendering}
            onInput={playbackPositionUpdater}
            onChange={playbackPositionUpdater}
          />
          {!isRendered && <input
            type="range"
            name="endMs"
            class="video-editor__range-bound video-editor__range-end"
            style={`--range-width: ${endRangePercentage}`}
            min={endMinimum}
            max={durationMs}
            step={CLIP_RANGE_STEP_MS}
            value={endMs}
            disabled={isRendering}
            onInput={rangeEndUpdater}
            onChange={rangeEndUpdater}
          />}
        </div>
      </div>
      <div class="video-editor__buttons">
        <input type="hidden" name="id" value={id} />
        <ClipMetadata {...props}/>
        <label class="video-editor__description">
          Description:
          <textarea
            name="description"
            value={description}
            onInput={inputHandler(updateDescription)}
            class="video-editor__description-editor"
            rows={2}
            disabled={isRendering}
            readOnly={isRendered}
          >
          </textarea>
        </label>
        <div class="action-row">
          <button type="submit" disabled={isRendering || isRendered}>
            Update
          </button>
          <button type="submit" disabled={isRendering || isRendered} formAction={cutEndpoint}>
            Cut
          </button>
        </div>
        {isRendered && mediaSourceSelector &&
          <form
            method="post"
            action={sendEndpoint}
            class="action-row"
          >
            <input type="hidden" name="id" value={id} />
            {mediaSourceSelector}
            <button type="submit">
              Send to program
            </button>
          </form>
        }
      </div>
    </form>
  );
};

function rangeUpdateHandler(
  videoRef: Ref<HTMLVideoElement>,
  rangeUpdater: StateUpdater<number>,
  playbackUpdater: (timestampMs: number) => void,
  offset = 0,
  minValue = 0,
): (event: Event) => void {
  return (e) => {
    if (!videoRef.current) {
      return;
    }
    const newValue = +(e.target as HTMLInputElement).value;
    if (offset && e.type === 'change') {
      const playbackStartMs = Math.max(newValue - offset, minValue);
      playbackUpdater(playbackStartMs);
    } else {
      playbackUpdater(newValue);
    }
    rangeUpdater(newValue);
    videoRef.current.pause();
  };
}

function playbackUpdateHandler(
  videoRef: Ref<HTMLVideoElement>,
  playbackUpdater: (timestampMs: number) => void,
): (event: Event) => void {
  return (e) => {
    if (!videoRef.current) {
      return;
    }
    const newValue = +(e.target as HTMLInputElement).value;
    playbackUpdater(newValue);
  };
}

function formatTimestampRange(clip: Clip, startMillis: number | undefined): string | undefined {
  if (startMillis == null) {
    return undefined;
  }
  // NOTE: Milliseconds are omitted to avoid giving the impression of greater
  // precision than we actually have. Also takes up less space.
  const startTs = startMillis >= 0 ? removeMs(fromMillis(startMillis)) : 'N/A';
  return isVideoClip(clip) ?
    `${startTs}–${removeMs(fromMillis(startMillis + clip.media.durationMs))}` :
    startTs;
}

function removeMs(timestamp: Timestamp): string {
  return timestamp.slice(0, -4);
}

interface ClipEditorProps<T extends Clip> {
  clipView: ClipView<T>;
  selected: boolean;
  mediaSourceSelector: VNode|null;
}

const ImageClipEditor: FunctionalComponent<ClipEditorProps<ImageClip>> = ({
  clipView,
  selected,
}) => {
  return selected ? <ImageViewer clipView={clipView} /> : null;
};

const VideoClipEditor: FunctionalComponent<ClipEditorProps<VideoClip>> = ({
  clipView: { clip, status },
  selected,
  mediaSourceSelector,
}) => {
  const durationMs = clip.media.durationMs;
  const [ startMs, updateStartMs ] = useLocalState(
    clip.clipStartMs,
    { transform: t => quantizedFloorFromBeginning(t, CLIP_RANGE_STEP_MS) },
  );
  const [ endMs, updateEndMs ] = useLocalState(
    clip.clipEndMs,
    { transform: t => quantizedCeilFromEnd(t, durationMs, CLIP_RANGE_STEP_MS) },
  );
  const [ description, updateDescription ] = useLocalState(clip.description);
  if (!selected) {
    return null;
  }
  return <VideoEditor
    id={clip.id}
    media={clip.media}
    waveform={clip.waveform}
    thumbnail={clip.thumbnail}
    recordingTimestampMs={clip.recordingTimestampMs}
    streamTimestampMs={clip.streamTimestampMs}
    status={status}
    clipStartMs={startMs}
    updateStartMs={updateStartMs}
    clipEndMs={endMs}
    updateEndMs={updateEndMs}
    description={description}
    updateDescription={updateDescription}
    autoplay={false}
    mediaSourceSelector={mediaSourceSelector}
  />;
};

const ClipDashboard: FunctionalComponent<Props> = ({
  state,
  recentScenes,
  addRecentScene,
}) => {
  const [ currentClipId, updateCurrentId ] = useState<Id | null>(null);
  const [ selectedMediaSource, updateSelectedMediaSource ] = useState<string|undefined>(undefined);
  useEffect(() => {
    if (selectedMediaSource != null && !state.mediaSources.includes(selectedMediaSource)) {
      updateSelectedMediaSource(undefined);
    }
  }, [ state.mediaSources, selectedMediaSource ]);
  const mediaSourceSelector = <MediaSourceSelector
    mediaSources={state.mediaSources}
    selectedMediaSource={selectedMediaSource}
    updateSelectedMediaSource={updateSelectedMediaSource}
  />;

  return (
    <div class="clips">
      <div class="clips__actions action-row">
        <SceneScreenshotMenu
          scenes={state.scenes}
          updateCurrentClipId={updateCurrentId}
          recentScenes={recentScenes}
          addRecentScene={addRecentScene}
        />
        {clipEndpoints.map(ep =>
          <button
            key={ep.displayName}
            type="button"
            onClick={() => ep.callback().then(updateCurrentId).catch(logError)}
          >
            {ep.displayName}
          </button>
        )}
      </div>
      { state.clips
        .filter(isImageClipView)
        .map(clipView =>
          <ImageClipEditor
            key={clipView.clip.id}
            clipView={clipView}
            selected={clipView.clip.id === currentClipId}
            mediaSourceSelector={mediaSourceSelector}
          />
        )
      }
      { state.clips
        .filter(isVideoClipView)
        .map(clipView =>
          <VideoClipEditor
            key={clipView.clip.id}
            clipView={clipView}
            selected={clipView.clip.id === currentClipId}
            mediaSourceSelector={mediaSourceSelector}
          />
        )
      }
      <div class="clips__clip-selector">
        <ClipSelector
          clips={state.clips}
          onSelect={updateCurrentId}
          currentClipId={currentClipId}
          includeNone={false}
        />
      </div>
    </div>
  );
};
export default ClipDashboard;

function MediaSourceSelector({
  mediaSources,
  selectedMediaSource,
  updateSelectedMediaSource,
}: {
  mediaSources: string[],
  selectedMediaSource: string|undefined,
  updateSelectedMediaSource: StateUpdater<string|undefined>,
}): VNode|null {
  if (mediaSources.length === 0) {
    return null;
  }
  return (
    <select
      name="sourceName"
      value={selectedMediaSource}
      onChange={e => updateSelectedMediaSource(e.currentTarget.value)}
      required
    >
      {mediaSources.sort().map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function quantizedFloorFromBeginning(time: number, step: number): number {
  return time - time % step;
}

function quantizedCeilFromBeginning(time: number, step: number): number {
  // Math! Javascript's modulo operator doesn't perform an actual modulo
  // operation on negative numbers. This article explains it pretty well:
  // https://maurobringolf.ch/2017/12/a-neat-trick-to-compute-modulo-of-negative-numbers/
  return time + ((-time % step + step) % step);
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function quantizedFloorFromEnd(time: number, totalDuration: number, step: number): number {
  const timeToEnd = totalDuration - time;
  return totalDuration - quantizedCeilFromBeginning(timeToEnd, step);
}

function quantizedCeilFromEnd(time: number, totalDuration: number, step: number): number {
  const timeToEnd = totalDuration - time;
  return totalDuration - quantizedFloorFromBeginning(timeToEnd, step);
}
