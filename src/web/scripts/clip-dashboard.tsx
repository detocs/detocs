import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { StateUpdater, useRef, useState } from 'preact/hooks';

import { ImageClip, VideoClip, isVideoClip, Clip } from '@models/media';
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

import { clipEndpoint } from './api';
import { ClipSelector } from './clip-selector';
import { useLocalState } from './hooks/local-state';
import { logError } from './log';
import { fromMillis } from '@util/timestamp';
import { Timestamp } from '@models/timestamp';
import { useEffect } from 'react';

interface Props {
  state: State;
  updateState: StateUpdater<State>;
}

interface ImageViewerProps {
  clipView: ClipView<ImageClip>;
}

interface VideoEditorProps {
  clipView: ClipView<VideoClip>;
  autoplay: boolean;
}

/**
 * When changing the end timestamp of a clip, this determines how much earlier
 * in the video we start playback for previewing
 */
const CLIP_END_PLAYBACK_OFFSET_MS = 2000;

/**
 * So that we don't have to adjust 1ms at a time
 */
const CLIP_RANGE_STEP_MS = 250;

const updateEndpoint = clipEndpoint('/update').href;
const cutEndpoint = clipEndpoint('/cut').href;
const screenshotEndpoint = clipEndpoint('/screenshot').href;
const clipEndpoints = [
  { displayName: 'Screenshot', callback: screenshot },
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

function screenshot(): Promise<string> {
  return fetch(screenshotEndpoint, { method: 'POST' })
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<GetClipResponse>)
    .then(resp => resp.id);
}

const ImageViewer: FunctionalComponent<ImageViewerProps> = ({ clipView }): VNode => {
  return (
    <div class="image-viewer">
      <div class="image-viewer__image">
        <img src={clipView.clip.media.url} />
      </div>
      <ClipMetadata {...clipView}/>
    </div>
  );
};

const VideoEdtior: FunctionalComponent<VideoEditorProps> = ({ clipView, autoplay }): VNode => {
  const { clip, status } = clipView;
  const durationMs = clip.media.durationMs;
  const disabled = status !== ClipStatus.Uncut;

  const videoRef = useRef<HTMLVideoElement>();
  const [ startMs, updateStartMs ] = useLocalState(
    clip.clipStartMs,
    t => quantizedFloorFromBeginning(t, CLIP_RANGE_STEP_MS),
  );
  const [ endMs, updateEndMs ] = useLocalState(
    clip.clipEndMs,
    t => quantizedCeilFromEnd(t, durationMs, CLIP_RANGE_STEP_MS),
  );
  const [ description, updateDescription ] = useLocalState(clip.description);
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
          src={`${clip.media.url}#t=${startMs / 1000},${endMs / 1000}`}
          onTimeUpdate={e => updateCurrentTime((e.target as HTMLVideoElement).currentTime * 1000)}
          autoPlay={autoplay && !disabled}
          preload={'metadata'}
          controls={true}
          loop={true}
          muted={true}
        >
        </video>
        <div class="video-editor__range">
          <img class="video-editor__waveform" src={clip.waveform.url} />
          <progress
            class="video-editor__progress"
            max={durationMs}
            value={Math.trunc(currentTime)}
          >
          </progress>
          <div
            class="video-editor__range-outline"
            style={`left: ${startMs/durationMs*100}%;` +
            `right: ${(durationMs - endMs)/durationMs*100}%;`}
          >
          </div>
          {!disabled && <input
            type="range"
            name="startMs"
            class="video-editor__range-bound video-editor__range-start"
            style={`--range-width: ${startRangePercentage}`}
            min={0}
            max={startMaximum}
            step={CLIP_RANGE_STEP_MS}
            value={startMs}
            disabled={disabled}
            onInput={(e) => {
              // TODO: Debounce
              if (!videoRef.current) {
                return;
              }
              const newStartMs = +(e.target as HTMLInputElement).value;
              videoRef.current.currentTime = newStartMs / 1000;
              updateStartMs(newStartMs);
              videoRef.current.pause();
            }}
            onChange={(e) => {
              if (!videoRef.current) {
                return;
              }
              const newStartMs = +(e.target as HTMLInputElement).value;
              videoRef.current.currentTime = newStartMs / 1000;
              updateStartMs(newStartMs);
              videoRef.current.pause();
            }}
          />}
          {!disabled && <input
            type="range"
            name="endMs"
            class="video-editor__range-bound video-editor__range-end"
            style={`--range-width: ${endRangePercentage}`}
            min={endMinimum}
            max={durationMs}
            step={CLIP_RANGE_STEP_MS}
            value={endMs}
            disabled={disabled}
            onInput={(e) => {
              if (!videoRef.current) {
                return;
              }
              const newEndMs = +(e.target as HTMLInputElement).value;
              videoRef.current.currentTime = newEndMs / 1000;
              updateEndMs(newEndMs);
              videoRef.current.pause();
            }}
            onChange={(e) => {
              if (!videoRef.current) {
                return;
              }
              const newEndMs = +(e.target as HTMLInputElement).value;
              const playbackStartMs = Math.max(newEndMs - CLIP_END_PLAYBACK_OFFSET_MS, startMs);
              videoRef.current.currentTime = playbackStartMs / 1000;
              updateEndMs(newEndMs);
              videoRef.current.pause();
            }}
          />}
        </div>
      </div>
      <div class="video-editor__buttons">
        <input type="hidden" name="id" value={clip.id} />
        <ClipMetadata {...clipView}/>
        <label class="video-editor__description">
          Description:
          <textarea
            name="description"
            value={description}
            onInput={inputHandler(updateDescription)}
            class="video-editor__description-editor"
            rows={1}
            disabled={disabled}
          >
          </textarea>
        </label>
        <div class="input-row">
          <button type="submit" disabled={disabled}>Update</button>
          <button type="submit" disabled={disabled} formAction={cutEndpoint}>Cut</button>
        </div>
      </div>
    </form>
  );
};

const ClipMetadata: FunctionalComponent<ClipView> = ({ clip }): VNode => {
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

const ClipDashboard: FunctionalComponent<Props> = ({ state }): VNode => {
  const [ currentClipId, updateCurrentId ] = useState<Id | null>(null);
  const clipView = !currentClipId ? state.clips[state.clips.length - 1] :
    state.clips.find(cv => cv.clip.id === currentClipId);
  return (
    <div class="clips">
      <div class="clips__actions">
        {clipEndpoints.map(ep =>
          <button
            type="button"
            onClick={() => ep.callback().then(updateCurrentId).catch(logError)}
          >
            {ep.displayName}
          </button>
        )}
      </div>
      { clipView && isImageClipView(clipView) && ImageViewer({ clipView })}
      { clipView && isVideoClipView(clipView) && VideoEdtior({ clipView, autoplay: false })}
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