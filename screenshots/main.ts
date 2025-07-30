import { promises as fs } from 'fs';
import path from 'path';
import { exit } from 'process';

import express from 'express';
import puppeteer, { Browser } from 'puppeteer';
import { Server } from 'ws';

import BracketState from '@server/bracket/state';
import {
  INFO_PORT,
  RECORDING_PORT,
  TWITTER_PORT,
  BRACKETS_PORT,
  MEDIA_DASHBOARD_PORT,
} from '@server/ports';
import RecordingState from '@server/recording/state';
import TwitterState from '@server/twitter/client-state';
import { sleep } from '@util/async';
import * as httpUtil from '@util/http-server';

import bracketState from './mock-state/bracket.json';
import clipState from './mock-state/clip.json';
import infoState from './mock-state/info.json';
import recordingState from './mock-state/recording.json';
import twitterState from './mock-state/twitter.json';

const PORT = 8080;

function startServer(): void {
  mockInfoServer();
  mockRecordingServer();
  mockTwitterServer();
  mockBracketServer();
  mockClipServer();
  webServer();
}

function webServer(): void {
  const app = express();
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/media', express.static(path.join(__dirname, '../../screenshots/mock-media')));
  app.listen(PORT);
}

function mockServer(port: number, state: unknown): {
  appServer: express.Express;
  socketServer: Server;
} {
  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    port,
    () => { /* void */ },
  );
  socketServer.on('connection', ws => {
    ws.send(JSON.stringify(state));
  });
  return { appServer, socketServer };
}

function mockInfoServer(): void {
  const { appServer } = mockServer(INFO_PORT, infoState);
  appServer.get('/people', (req, res) => {
    res.send([]);
  });
  appServer.get('/games', (req, res) => {
    res.send([]);
  });
  appServer.get('/matches', (req, res) => {
    res.send([]);
  });
}

function mockRecordingServer(): void {
  mockServer(RECORDING_PORT, recordingState as RecordingState);
}

function mockTwitterServer(): void {
  mockServer(TWITTER_PORT, twitterState as TwitterState);
}

function mockBracketServer(): void {
  mockServer(BRACKETS_PORT, bracketState as BracketState);
}

function mockClipServer(): void {
  mockServer(MEDIA_DASHBOARD_PORT, clipState);
}

interface ScreenshotTask {
  url: string;
  viewport: {
    width: number;
    height: number;
  };
  outputPath: string;
  actions?: (page: puppeteer.Page) => Promise<void>;
}

async function takeScreenshots(): Promise<void> {
  startServer();
  const browser = await puppeteer.launch({
    headless: false,
  });
  const tasks: ScreenshotTask[] = [
    {
      url: '/#scoreboard',
      viewport: { width: 1120, height: 250 },
      outputPath: 'docs/images/tab_scoreboard.png',
    },
    {
      url: '/#scoreboard',
      viewport: { width: 1120, height: 370 },
      outputPath: 'docs/images/tab_scoreboard_addl-fields.png',
      actions: async (page) => {
        const btn1 = await page.waitForSelector('aria/More Fields');
        await btn1?.click();
        const btn2 = await page.waitForSelector('aria/More Fields');
        await btn2?.click();
        const body = await page.waitForSelector('body');
        await body?.click();
      },
    },
    {
      url: '/#commentary',
      viewport: { width: 1120, height: 230 },
      outputPath: 'docs/images/tab_commentary.png',
    },
    {
      url: '/#recording',
      viewport: { width: 1120, height: 520 },
      outputPath: 'docs/images/tab_recording.png',
    },
    {
      url: '/#twitter',
      viewport: { width: 1120, height: 360 },
      outputPath: 'docs/images/tab_twitter.png',
      actions: async (page) => {
        await page.type('aria/Tweet body', `
I'm so glad they increased the character limit on Twitter from 140 characters.

DETOCS correctly calculates tweet character usage, so even long URLs like this:
https://github.com/detocs/detocs/blob/master/src/server/bracket/server.ts
still consume a fixed number of characters.

#DETOCS
          `.trim());
      },
    },
    {
      url: '/#clips',
      viewport: { width: 1120, height: 500 },
      outputPath: 'docs/images/tab_clips.png',
      actions: async (page) => {
        await sleep(200000);
        debugger;
        const clip = await page.waitForSelector('aria/First Screenshot');
        await clip?.click();
        await page.waitForNetworkIdle();
      },
    },
    {
      url: '/#clips',
      viewport: { width: 1120, height: 500 },
      outputPath: 'docs/images/tab_clips_video.png',
      actions: async (page) => {
        const clip = await page.waitForSelector('aria/Second Clip');
        await clip?.click();
        const seekBar = await page.waitForSelector('aria/Playback position');
        await sleep(100);
        await seekBar?.click({ offset: { x: 500, y: 10 } });
        await page.waitForNetworkIdle();
        await sleep(500); // The loading indicator doesn't disappear immediately
      },
    },
    {
      url: '/#bracket',
      viewport: { width: 1120, height: 400 },
      outputPath: 'docs/images/tab_bracket.png',
    },
    {
      url: '/#break',
      viewport: { width: 1120, height: 230 },
      outputPath: 'docs/images/tab_break.png',
    },
    {
      url: '/#settings',
      viewport: { width: 1120, height: 200 },
      outputPath: 'docs/images/tab_settings.png',
    },
  ];
  await Promise.all(tasks.slice(5,6).map(task => takeScreenshot(browser, task)));
  await browser.close();
  exit();
}

async function takeScreenshot(browser: Browser, {
  url,
  viewport,
  outputPath,
  actions,
}: ScreenshotTask): Promise<void> {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{
    name: 'prefers-reduced-motion',
    value: 'reduce',
  }]);
  const fullUrl = `http://localhost:${PORT}${url}`;
  console.log(`Opening ${fullUrl}`);
  await page.goto(fullUrl, { waitUntil: 'load' });
  await sleep(100);
  actions && await actions(page);
  console.log(`Saving ${outputPath}`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath });
  await page.close();
}

takeScreenshots();
