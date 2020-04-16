import { h, FunctionalComponent, VNode, Fragment } from 'preact';
import { StateUpdater, useRef, useState } from 'preact/hooks';

import { Clip } from '../../models/media';
import { State } from '../../server/media-dashboard/state';

import { mediaDashboardEndpoint } from './api';
import { useLocalState } from './hooks/local-state';

interface Props {
  state: State;
  updateState: StateUpdater<State>;
}

interface EditorProps {
  clip: Clip;
  autoplay: boolean;
}

/**
 * When changing the end timestamp of a clip, this determines how much early in
 * the video we start playback for previewing
 */
const CLIP_END_PLAYBACK_OFFSET_MS = 2000;

/**
 * So that we don't have to adjust 1ms at a time
 */
const CLIP_RANGE_STEP_MS = 250;

const updateEndpoint = mediaDashboardEndpoint('/update').href;
const cutEndpoint = mediaDashboardEndpoint('/cut').href;
const clip10Endpoint = mediaDashboardEndpoint('/clip10').href;

function clip10(): void {
  fetch(clip10Endpoint, { method: 'POST' }).catch(console.error);
}

const VideoEdtior: FunctionalComponent<EditorProps> = ({ clip, autoplay }): VNode => {
  const durationMs = clip.video.durationMs;
  const videoRef = useRef<HTMLVideoElement>();
  const [ startMs, updateStartMs ] = useLocalState(
    clip.clipStartMs,
    t => quantizedFloorFromBeginning(t, CLIP_RANGE_STEP_MS),
  );
  const [ endMs, updateEndMs ] = useLocalState(
    clip.clipEndMs,
    t => quantizedCeilFromEnd(t, durationMs, CLIP_RANGE_STEP_MS),
  );
  const [ currentTime, updateCurrentTime ] = useState(0);
  const startMaximum = endMs;
  const startRangePercentage = `${startMaximum / durationMs * 100}%`;
  const endMinimum = quantizedCeilFromEnd(startMs, durationMs, CLIP_RANGE_STEP_MS);
  const endRangePercentage = `${(durationMs - endMinimum) / durationMs * 100}%`;
  return (
    <form
      method="post"
      action={updateEndpoint}
      class="video-editor"
      autocomplete="off"
    >
      <div className="video-editor__trimmer">
        <video
          class="video-editor__video"
          ref={videoRef}
          src={`${clip.video.url}#t=${startMs / 1000},${endMs / 1000}`}
          onTimeUpdate={e => updateCurrentTime((e.target as HTMLVideoElement).currentTime * 1000)}
          autoPlay={autoplay}
          controls
          loop={true}
          muted={true}
        >
        </video>
        <div class="video-editor__range">
          <img class="video-editor__waveform" src={clip.waveform.url} />
          <progress
            className="video-editor__progress"
            max={durationMs}
            value={Math.trunc(currentTime)}
          >
          </progress>
          <div
            className="video-editor__range-outline"
            style={`left: ${startMs/durationMs*100}%;` +
            `right: ${(durationMs - endMs)/durationMs*100}%;`}
          >
          </div>
          <input
            type="range"
            name="startMs"
            className="video-editor__range-bound video-editor__range-start"
            style={`--range-width: ${startRangePercentage}`}
            min={0}
            max={startMaximum}
            step={CLIP_RANGE_STEP_MS}
            value={startMs}
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
          />
          <input
            type="range"
            name="endMs"
            className="video-editor__range-bound video-editor__range-end"
            style={`--range-width: ${endRangePercentage}`}
            min={endMinimum}
            max={durationMs}
            step={CLIP_RANGE_STEP_MS}
            value={endMs}
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
          />
        </div>
      </div>
      <div className="video-editor__buttons">
        <input type="hidden" name="id" value={clip.id} />
        <textarea
          name="description"
          value={clip.description}
          className="video-editor__description"
          rows={3}
        >
        </textarea>
        <button type="submit">Update</button>
        <button type="submit" formAction={cutEndpoint}>Cut</button>
      </div>
    </form>
  );
};

const ClipDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  return (
    <Fragment>
      <div class="input-row">
        <button type="button" onClick={clip10}>10s</button>
      </div>
      <ol class="clips__list">
        {state.clips
          .slice()
          .reverse()
          .map((clip, i) =>
            <li key={clip.id} class="clips__list-item">
              {VideoEdtior({ clip, autoplay: i === 0 })}
            </li>)}
      </ol>
    </Fragment>
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

function quantizedFloorFromEnd(time: number, totalDuration: number, step: number): number {
  const timeToEnd = totalDuration - time;
  return totalDuration - quantizedCeilFromBeginning(timeToEnd, step);
}

function quantizedCeilFromEnd(time: number, totalDuration: number, step: number): number {
  const timeToEnd = totalDuration - time;
  return totalDuration - quantizedFloorFromBeginning(timeToEnd, step);
}
