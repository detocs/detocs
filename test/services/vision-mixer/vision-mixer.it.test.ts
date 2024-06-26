import VisionMixer from '@services/vision-mixer-service';
import { sleep, toPromise, waitUntil } from '@util/async';
import { parseHeight, parseWidth } from '@util/png';
import { toMillis, validateTimestamp } from '@util/timestamp';

import { setupObs27, setupObs28, setupObs29, setupObs30 } from './setup-obs';

type SetupFn = () => Promise<{
  visionMixer: VisionMixer,
  teardown: () => void,
}>;

describe.each([
  ['OBS 27', setupObs27],
  ['OBS 28', setupObs28],
  ['OBS 29', setupObs29],
  ['OBS 30', setupObs30],
])('%s integration', (name: string, setupFn: SetupFn) => {
  let vm: VisionMixer;
  let teardown: () => void;

  beforeAll(async () => {
    // configureLogger();
    const out = await setupFn();
    vm = out.visionMixer;
    teardown = out.teardown;
  }, 300_000);

  afterAll(() => {
    teardown();
  });

  it('can connect', async () => {
    await toPromise(vm.connect());
    await sleep(100);
    await toPromise(vm.disconnect());
  }, 10_000);

  it('tracks connection status', async () => {
    await toPromise(vm.connect());
    const wasConnected = vm.isConnected();
    await sleep(100);
    await toPromise(vm.disconnect());
    const isConnected = vm.isConnected();
    expect(wasConnected).toBe(true);
    expect(isConnected).toBe(false);
  });

  it('calls onConnect callback', async () => {
    const connected = jest.fn();
    vm.onConnect(connected);
    await toPromise(vm.connect());
    await sleep(100);
    await toPromise(vm.disconnect());
    expect(connected).toHaveBeenCalledTimes(1);
  });

  it('can get output dimensions', async () => {
    const dims = await toPromise(vm.getOutputDimensions());
    await sleep(100);
    await toPromise(vm.disconnect());
    expect(dims.width).toBe(1280);
    expect(dims.height).toBe(720);
  });

  it('can start and stop recording', async () => {
    const started = jest.fn();
    const stopped = jest.fn();
    await toPromise(vm.connect());
    expect(await toPromise(vm.isRecording())).toBe(false);
    vm.onRecordingStart(started);
    vm.onRecordingStop(stopped);
    await toPromise(vm.startRecording());
    await waitUntil(() => toPromise(
      vm.getTimestamps()
        .map(t => toMillis(t.recordingTimestamp ?? '0:00:00') > 0),
    ), 10_000);
    expect(started).toBeCalledTimes(1);
    expect(await toPromise(vm.isRecording())).toBe(true);
    await toPromise(vm.stopRecording());
    await waitUntil(() => toPromise(vm.isRecording().map(b => !b)), 10_000);
    expect(stopped).toBeCalledTimes(1);
    expect(await toPromise(vm.isRecording())).toBe(false);
    await toPromise(vm.disconnect());
  }, 25_000);


  it('can get timestamps', async () => {
    await toPromise(vm.startRecording());
    await waitUntil(() => toPromise(
      vm.getTimestamps()
        .map(t => toMillis(t.recordingTimestamp ?? '0:00:00') > 0),
    ), 10_000);
    const status1 = await toPromise(vm.getTimestamps());
    await sleep(1000);
    const status2 = await toPromise(vm.getTimestamps());
    await toPromise(vm.stopRecording());
    await waitUntil(() => toPromise(vm.isRecording().map(b => !b)), 10_000);
    await toPromise(vm.disconnect());
    expect(status1.streamTimestamp).toBeNull();
    expect(status1.recordingTimestamp).not.toBeNull();
    expect(validateTimestamp(status1.recordingTimestamp ?? '')).toBe(true);
    const millis1 = toMillis(status1.recordingTimestamp ?? '');
    expect(millis1).toBeGreaterThan(0);
    expect(millis1).toBeLessThan(2000);
    expect(status2.streamTimestamp).toBeNull();
    expect(status2.recordingTimestamp).not.toBeNull();
    expect(validateTimestamp(status2.recordingTimestamp ?? '')).toBe(true);
    const millis2 = toMillis(status2.recordingTimestamp ?? '');
    expect(millis2).toBeGreaterThan(0);
    expect(millis2).toBeLessThan(2000);
    expect(millis2 - millis1).toBeGreaterThan(900);
  }, 15_000);

  it('can get recording folder', async () => {
    const folder = await toPromise(vm.getRecordingFolder());
    await toPromise(vm.disconnect());
    expect(folder).toContain('detocs-testing');
  });

  it('can get recording file', async () => {
    await toPromise(vm.startRecording());
    await waitUntil(() => toPromise(
      vm.getTimestamps()
        .map(t => toMillis(t.recordingTimestamp ?? '0:00:00') > 0),
    ), 10_000);
    const file = await toPromise(vm.getRecordingFile());
    await toPromise(vm.stopRecording());
    await waitUntil(() => toPromise(vm.isRecording().map(b => !b)), 10_000);
    await toPromise(vm.disconnect());
    expect(file).toContain('detocs-testing');
  }, 15_000);

  it('can save replay buffer', async () => {
    const replay = await toPromise(vm.saveReplayBuffer());
    await toPromise(vm.disconnect());
    expect(replay).toContain('detocs-testing');
  });

  it('can save get source thumbnail with default size', async () => {
    const thumb = await toPromise(vm.getSourceThumbnail('Scene'));
    await toPromise(vm.disconnect());
    expect(parseWidth(thumb.data)).toBe(1920);
    expect(parseHeight(thumb.data)).toBe(1080);
  });

  it('can save get source thumbnail with set height', async () => {
    const thumb = await toPromise(vm.getSourceThumbnail('Scene', { height: 180 }));
    await toPromise(vm.disconnect());
    expect(parseWidth(thumb.data)).toBe(320);
    expect(parseHeight(thumb.data)).toBe(180);
  });

  it('can save get current source thumbnail', async () => {
    const thumb = await toPromise(vm.getSourceThumbnail('Scene'));
    await toPromise(vm.disconnect());
    expect(parseWidth(thumb.data)).toBe(1920);
    expect(parseHeight(thumb.data)).toBe(1080);
  });
}, 300_000);
