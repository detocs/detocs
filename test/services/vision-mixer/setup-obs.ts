import * as child_process from 'child_process';
import ObsWebSocket from 'obs-websocket-js';
import ObsWebSocket4 from 'obs-websocket-js-4';
import { dirname, join } from 'path';
import { promisify } from 'util';

import { ObsConnectionImpl as LegacyConnection } from '@services/obs-legacy/connection';
import ObsLegacyClient from '@services/obs-legacy/obs';
import VisionMixer from '@services/vision-mixer-service';
import { Config } from '@util/configuration/config';
import { ObsConnectionImpl } from '@services/obs/connection';
import ObsClient from '@services/obs/obs';

const exec = promisify(child_process.exec);

const DIR = __dirname;

export async function setupObs27(): Promise<{
  visionMixer: VisionMixer,
  teardown: () => void,
}> {
  const obs = await installObs('obs27-windows.ps1');
  const config: Config['obs'] = {
    address: 'localhost:41234',
    password: 'test1234',
    webSocketVersion: 4,
  };
  const obsConn = new LegacyConnection(new ObsWebSocket4(), config);
  const obsClient = new ObsLegacyClient(obsConn, config);
  return ({
    visionMixer: obsClient,
    teardown: () => obs.kill(),
  });
}

export async function setupObs28(): Promise<{
  visionMixer: VisionMixer,
  teardown: () => void,
}> {
  const obs = await installObs('obs28-windows.ps1');
  const config: Config['obs'] = {
    address: 'localhost:41235',
    password: 'test1234',
    webSocketVersion: 5,
  };
  const obsConn = new ObsConnectionImpl(new ObsWebSocket(), config);
  const obsClient = new ObsClient(obsConn, config);
  return ({
    visionMixer: obsClient,
    teardown: () => obs.kill(),
  });
}

export async function setupObs29(): Promise<{
  visionMixer: VisionMixer,
  teardown: () => void,
}> {
  const obs = await installObs('obs29-windows.ps1');
  const config: Config['obs'] = {
    address: 'localhost:41236',
    password: 'test1234',
    webSocketVersion: 5,
  };
  const obsConn = new ObsConnectionImpl(new ObsWebSocket(), config);
  const obsClient = new ObsClient(obsConn, config);
  return ({
    visionMixer: obsClient,
    teardown: () => obs.kill(),
  });
}

export async function setupObs30(): Promise<{
  visionMixer: VisionMixer,
  teardown: () => void,
}> {
  const obs = await installObs('obs30-windows.ps1');
  const config: Config['obs'] = {
    address: 'localhost:41237',
    password: 'test1234',
    webSocketVersion: 5,
  };
  const obsConn = new ObsConnectionImpl(new ObsWebSocket(), config);
  const obsClient = new ObsClient(obsConn, config);
  return ({
    visionMixer: obsClient,
    teardown: () => obs.kill(),
  });
}

export async function setupObs31(): Promise<{
  visionMixer: VisionMixer,
  teardown: () => void,
}> {
  const obs = await installObs('obs31-windows.ps1');
  const config: Config['obs'] = {
    address: 'localhost:41238',
    password: 'test1234',
    webSocketVersion: 5,
  };
  const obsConn = new ObsConnectionImpl(new ObsWebSocket(), config);
  const obsClient = new ObsClient(obsConn, config);
  return ({
    visionMixer: obsClient,
    teardown: () => obs.kill(),
  });
}

async function installObs(installScript: string): Promise<child_process.ChildProcess> {
  const script = join(DIR, installScript);
  const output = await exec(script, {
    shell: 'powershell.exe',
  });
  const executable = output.stdout.trim();
  const obs = child_process.execFile(
    executable,
    [
      '--startreplaybuffer',
      '--minimize-to-tray',
      '--multi',
      '--disable-updater',
    ],
    {
      cwd: dirname(executable),
    }
  );
  return obs;
}

