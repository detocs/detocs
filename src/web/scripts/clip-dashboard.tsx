import throttle from 'lodash.throttle';
import { h, FunctionalComponent, Fragment, VNode, ComponentChild } from 'preact';
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
import { cancelFormSubmission, getFormRoute } from './form-ajax';
import useId from './hooks/id';
import { useLocalState } from './hooks/local-state';
import Icon from './icon';
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
  mediaSourceSelector: ComponentChild;
  visionMixerName: string|null;
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
const EDITOR_DEBOUNCE_TIME = 250;

const updateEndpoint = clipEndpoint('/update').href;
const deleteEndpoint = clipEndpoint('/delete').href;
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
    <form
      class="image-viewer"
      autocomplete="off"
      onSubmit={confirmDelete}
    >
      <div class="image-viewer__image">
        <img src={clipView.clip.media.url} />
      </div>
      <div class="image-viewer__buttons">
        <input type="hidden" name="id" value={clipView.clip.id} />
        <ClipMetadata {...clipView.clip}/>
        <div class="action-row">
          <button
            type="submit"
            class="warning"
            formAction={deleteEndpoint}
            // Non-standard
            formMethod="delete"
          >
            Delete
          </button>
        </div>
      </div>
    </form>
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
    visionMixerName,
  } = props;
  const isRendering = status === ClipStatus.Rendering;
  const isRendered = status === ClipStatus.Rendered;
  const durationMs = media.durationMs;

  const videoRef = useRef<HTMLVideoElement>(null);
  const trimmerRef = useRef<HTMLDivElement>(null);
  const [ currentTime, updateCurrentTime ] = useState(0);
  const [ playing, updatePlaying ] = useState(false);
  const [ playbackRate, updatePlaybackRate ] = useState(1.0);
  const [ muted, updateMuted ] = useState(true);
  const [ volume, updateVolume ] = useState(0.0);
  const [ fullscreen, updateFullscreen ] = useState(false);
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

  const togglePlay = (): void => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    updatePlaying(!video.paused);
    function updatePlayState(e: Event): void {
      const video = e.target as HTMLVideoElement;
      updatePlaying(!video.paused);
    }
    video.addEventListener('play', updatePlayState);
    video.addEventListener('pause', updatePlayState);
    return function cleanup() {
      video.removeEventListener('play', updatePlayState);
      video.removeEventListener('pause', updatePlayState);
    };
  }, []);

  const setPlaybackRate = (value: number): void => {
    if (videoRef.current) {
      videoRef.current.playbackRate = value;
    }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    updatePlaybackRate(video.playbackRate);
    function updatePlaybackRateState(e: Event): void {
      const video = e.target as HTMLVideoElement;
      updatePlaybackRate(video.playbackRate);
    }
    video.addEventListener('ratechange', updatePlaybackRateState);
    return function cleanup() {
      video.removeEventListener('ratechange', updatePlaybackRateState);
    };
  }, []);

  const toggleMute = (): void => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  };
  const setVolume = (value: number): void => {
    if (videoRef.current) {
      videoRef.current.volume = value;
      videoRef.current.muted = false;
    }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    updateMuted(video.muted);
    updateVolume(video.volume);
    function updateVolumeState(e: Event): void {
      const video = e.target as HTMLVideoElement;
      updateMuted(video.muted);
      updateVolume(video.volume);
    }
    video.addEventListener('volumechange', updateVolumeState);
    return function cleanup() {
      video.removeEventListener('volumechange', updateVolumeState);
    };
  }, []);

  const toggleFullscreen = (): void => {
    if (trimmerRef.current) {
      if (document.fullscreenElement === trimmerRef.current) {
        document.exitFullscreen();
      } else {
        trimmerRef.current.requestFullscreen();
      }
    }
  };
  useEffect(() => {
    function handler(): void {
      updateFullscreen(document.fullscreenElement === trimmerRef.current);
    }
    document.addEventListener('fullscreenchange', handler);
    return function cleanup() {
      document.removeEventListener('fullscreenchange', handler);
    };
  }, []);

  const prevTimestamp = useRef(startMs);
  const handleTimeUpdate = (e: Event): void => {
    const video = e.target as HTMLVideoElement;
    const timestamp = video.currentTime * 1000;
    updateCurrentTime(timestamp);

    // I checked to see if the requestVideoFrameCallback method might allow for faster detection of
    // the video element looping, but it looks like it happens at the same time as the `timeupdate`
    // event. The API would allow for more accurate looping for segments that don't end at the end
    // of the video, but I don't think it's worth the effort.

    const prevInRange = prevTimestamp.current >= startMs && prevTimestamp.current <= endMs;
    const currentOutOfRange = timestamp < startMs || timestamp > endMs;
    if (prevInRange && currentOutOfRange) {
      updateCurrentTime(startMs);
      video.currentTime = startMs / 1000;
    }
    prevTimestamp.current = timestamp;
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = startMs / 1000;
      videoRef.current.muted = true;
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

  const rangeStartUpdater = throttle(
    rangeUpdateHandler(videoRef, updateStartMs, playbackUpdater),
    EDITOR_DEBOUNCE_TIME,
    { leading: true, trailing: true },
  );

  const playbackPositionUpdater = throttle(
    playbackUpdateHandler(videoRef, playbackUpdater),
    EDITOR_DEBOUNCE_TIME,
    { leading: true, trailing: true },
  );

  const rangeEndUpdater = throttle(
    rangeUpdateHandler(
      videoRef,
      updateEndMs,
      playbackUpdater,
      CLIP_END_PLAYBACK_OFFSET_MS,
      startMs,
    ),
    EDITOR_DEBOUNCE_TIME,
    { leading: true, trailing: true },
  );

  return (
    <form
      method="post"
      action={updateEndpoint}
      class="video-editor"
      autocomplete="off"
      onSubmit={confirmDelete}
    >
      <div class="video-editor__trimmer" ref={trimmerRef} aria-busy={status === ClipStatus.Rendering}>
        <video
          class="video-editor__video"
          ref={videoRef}
          src={media.url}
          onTimeUpdate={handleTimeUpdate}
          onClick={togglePlay}
          autoPlay={autoplay && !isRendering}
          preload={'metadata'}
          controls={false}
          loop={true}
        >
        </video>
        <VideoControls
          currentTime={currentTime}
          durationMs={durationMs}
          playing={playing}
          togglePlay={togglePlay}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          muted={muted}
          toggleMute={toggleMute}
          volume={volume}
          setVolume={setVolume}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
        />
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
            onMouseDown={e => (e.target as HTMLInputElement).step = "1"}
            onMouseUp={e => (e.target as HTMLInputElement).step = CLIP_RANGE_STEP_MS.toString()}
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
          <button
            type="submit"
            disabled={isRendering}
            class="warning"
            formAction={deleteEndpoint}
            // Non-standard
            formMethod="delete"
          >
            Delete
          </button>
        </div>
        {isRendered && mediaSourceSelector &&
          <div
            class="action-row"
          >
            {mediaSourceSelector}
            <button
              type="submit"
              formMethod="post"
              formAction={sendEndpoint}
            >
              Send to {visionMixerName}
            </button>
          </div>
        }
      </div>
    </form>
  );
};

function VideoControls({
  currentTime,
  durationMs,
  playing,
  togglePlay,
  playbackRate,
  setPlaybackRate,
  muted,
  toggleMute,
  volume,
  setVolume,
  fullscreen,
  toggleFullscreen,
}: {
  currentTime: number;
  durationMs: number;
  playing: boolean;
  togglePlay: () => void;
  playbackRate: number;
  setPlaybackRate: (value: number) => void;
  muted: boolean;
  toggleMute: () => void;
  volume: number;
  setVolume: (value: number) => void;
  fullscreen: boolean;
  toggleFullscreen: () => void;
}): VNode|null {
  const [rateId, rateListId, volumeId, volumeListId] = useId(4, 'video-editor__controls-');
  const rateMin = -3;
  const rateMax = 3;

  const onPlaybackRateChange = (e: Event): void => {
    const exponent = +(e.target as HTMLInputElement).value;
    setPlaybackRate(Math.pow(2, exponent));
  };
  const onVolumeChange = (e: Event): void => {
    const newVolume = +(e.target as HTMLInputElement).value;
    setVolume(newVolume);
  };

  const includeMinutes = durationMs >= 60 * 1000;
  function formatDuration(ms: number): VNode {
    const str = new Date(ms).toISOString();
    const milliseconds = str.slice(-5, -1);
    const seconds = str.slice(includeMinutes ? 14 : 17, 19);
    return (
      <span class="video-editor__control-time">
        {seconds}
        <span class="video-editor__control-milliseconds">{milliseconds}</span>
      </span>
    );
  }

  return (
    <div class="video-editor__controls">
      <span class="video-editor__control-group">
        <button onClick={togglePlay}>
          {playing ? <Icon name="pause" label="Pause" /> : <Icon name="play" label="Play" />}
        </button>
        {formatDuration(currentTime)} / {formatDuration(durationMs)}
        <span class="video-editor__control-subgroup">
          <input
            id={rateId}
            type="range"
            class="video-editor__control-range"
            value={Math.log2(playbackRate)}
            onInput={onPlaybackRateChange}
            onChange={onPlaybackRateChange}
            min={rateMin}
            max={rateMax}
            step="0.5"
            list={rateListId}
            title="Playback Rate"
            aria-label="Playback Rate"
          />
          <datalist id={rateListId}>
            {Array.from({ length: rateMax - rateMin + 1 }, (_, i) => rateMin + i).map(i =>
              <option key={i} value={i} label={`${Math.pow(2, i).toFixed(2)}x`} />
            )}
          </datalist>
          <output for={rateId}>
            {playbackRate.toPrecision(3)}x
          </output>
        </span>
      </span>
      <span class="video-editor__control-group">
        <span class="video-editor__control-subgroup">
          <button onClick={toggleMute}>
            {muted ? <Icon name="mute" label="Unmute"/> : <Icon name="volume" label="Mute" />}
          </button>
          <input
            type="range"
            class="video-editor__control-range"
            value={muted ? 0 : volume}
            onInput={onVolumeChange}
            onChange={onVolumeChange}
            min="0"
            max="1"
            step="0.05"
            list={volumeListId}
            title="Volume"
            aria-label="Volume"
          />
          <datalist id={volumeListId}>
            {Array.from({ length: 5 }, (_, i) => i * 25).map(i =>
              <option key={i} value={i/100} label={`${i}%`} />
            )}
          </datalist>
          <output for={volumeId}>
            {((muted ? 0 : volume) * 100).toFixed(0).padStart(3, "0")}%
          </output>
        </span>
        <button onClick={toggleFullscreen}>
          {fullscreen
            ? <Icon name="windowed" label="Exit Fullscreen" />
            : <Icon name="fullscreen" label="Fullscreen" />
          }
        </button>
      </span>
    </div>
  );
}

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
  mediaSourceSelector: ComponentChild;
  visionMixerName: string|null;
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
  visionMixerName,
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
    visionMixerName={visionMixerName}
  />;
};

const ClipDashboard: FunctionalComponent<Props> = ({
  state,
  recentScenes,
  addRecentScene,
}) => {
  const [ currentClipId, updateCurrentId ] = useState<Id|null>(null);
  const [ selectedMediaSource, updateSelectedMediaSource ] = useState<string|undefined>(undefined);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedMediaSource != null &&
      !state.visionMixer.mediaSources.includes(selectedMediaSource)
    ) {
      updateSelectedMediaSource(undefined);
    }
  }, [ state.visionMixer.mediaSources, selectedMediaSource ]);
  useEffect(() => {
    if (currentClipId != null &&
      !state.clips.map<Id|null>(clipView => clipView.clip.id).includes(currentClipId))
    {
      updateCurrentId(null);
      selectorRef.current?.focus();
    }
  }, [ state.clips, currentClipId ]);

  const mediaSourceSelector = renderMediaSourceSelector({
    mediaSources: state.visionMixer.mediaSources,
    selectedMediaSource,
    updateSelectedMediaSource,
  });

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
      <div class="clips__clip-selector" ref={selectorRef} tabIndex={-1}>
        { state.clips.length > 0 &&
          <ClipSelector
            clips={state.clips}
            onSelect={updateCurrentId}
            currentClipId={currentClipId}
            includeNone={false}
          />
        }
      </div>
      { state.clips
        .filter(isImageClipView)
        .map(clipView =>
          <ImageClipEditor
            key={clipView.clip.id}
            clipView={clipView}
            selected={clipView.clip.id === currentClipId}
            mediaSourceSelector={mediaSourceSelector}
            visionMixerName={state.visionMixer.name}
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
            visionMixerName={state.visionMixer.name}
          />
        )
      }
    </div>
  );
};
export default ClipDashboard;

function renderMediaSourceSelector({
  mediaSources,
  selectedMediaSource,
  updateSelectedMediaSource,
}: {
  mediaSources: string[],
  selectedMediaSource: string|undefined,
  updateSelectedMediaSource: StateUpdater<string|undefined>,
}): ComponentChild {
  if (mediaSources.length === 0) {
    return false;
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

function confirmDelete(e: Event): void {
  const { method } = getFormRoute(e.target as HTMLFormElement);
  if (method === 'delete') {
    if (!window.confirm('Are you sure you want to delete this?')) {
      cancelFormSubmission(e);
    }
  }
}
