import ObsWebSocket from 'obs-websocket-js';

export async function isRecording(obs: ObsWebSocket): Promise<boolean> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['recording'] || false;
}

export async function getRecordingTimestamp(obs: ObsWebSocket): Promise<string | null> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['rec-timecode'] || null;
}

export async function getRecordingFolder(obs: ObsWebSocket): Promise<string> {
  const resp = await obs.send('GetRecordingFolder');
  return resp['rec-folder'];
}

export async function getCurrentThumbnail(
  obs: ObsWebSocket,
  width: number = 240,
  height: number = 135,
): Promise<string | null> {
  const sceneResp = await obs.send('GetCurrentScene');
  if (!sceneResp) {
    return null;
  }
  const resp = await obs.send('TakeSourceScreenshot', {
    sourceName: sceneResp['name'],
    embedPictureFormat: 'png',
    width: width,
    height: height,
  });
  return resp ? resp['img'] as string : null;
}

