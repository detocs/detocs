import path from 'path';

import { getConfig, loadConfig } from '@util/configuration/config'

function testDataPath(filename: string): string {
  return path.join(__dirname, 'testdata', filename);
}

describe(loadConfig, () => {
  it('resolves unix relative paths', async () => {
    await loadConfig(testDataPath('relative-paths-unix.json'))
    const config = getConfig();
    expect(config.credentialsFile)
      .toEqual(testDataPath('credentials.json'));
    expect(path.isAbsolute(config.credentialsFile || ''))
      .toBe(true);
  });

  it('resolves windows relative paths', async () => {
    await loadConfig(testDataPath('relative-paths-windows.json'))
    const config = getConfig();
    expect(config.credentialsFile)
      .toEqual(testDataPath('credentials.json'));
    expect(path.isAbsolute(config.credentialsFile || ''))
      .toBe(true);
  });

  it('is backwards-compatible with old tempalte fields', async () => {
    await loadConfig(testDataPath('template-backwards-compatibility.json'))
    const config = getConfig();
    expect(config.templates.vod.singleVideo.description)
      .toEqual(testDataPath('test-single-video.hbs'));
    expect(config.vodSingleVideoTemplate)
      .toBeUndefined();
    expect(config.templates.vod.perSet.description)
      .toEqual(testDataPath('test-per-set.hbs'));
    expect(config.vodPerSetTemplate)
      .toBeUndefined();
  });
});
