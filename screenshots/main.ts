import { promises as fs } from 'fs';
import path from 'path';
import { exit } from 'process';

import express from 'express';
import puppeteer from 'puppeteer';
import { Server } from 'ws';

import { nullState as nullBracketState } from '@server/bracket/state';
import { nullState as nullClipState } from '@server/clip/state';
import { nullState as nullInfoState } from '@server/info/state';
import {
  INFO_PORT,
  RECORDING_PORT,
  TWITTER_PORT,
  BRACKETS_PORT,
  MEDIA_DASHBOARD_PORT,
} from '@server/ports';
import { nullState as nullRecordingState } from '@server/recording/state';
import { nullState as nullTwitterState } from '@server/twitter/client-state';
import * as httpUtil from '@util/http-server';

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
  app.listen(PORT);
}

function mockInfoServer(): void {
  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    INFO_PORT,
    () => { /* void */ },
  );
  const state = nullInfoState;
  socketServer.on('connection', ws => {
    ws.send(JSON.stringify(state));
  });
  appServer.get('/people', (req, res) => {
    res.send([]);
  });
}

function mockRecordingServer(): void {
  return mockServer(RECORDING_PORT, nullRecordingState);
}

function mockTwitterServer(): void {
  return mockServer(TWITTER_PORT, nullTwitterState);
}

function mockBracketServer(): void {
  return mockServer(BRACKETS_PORT, nullBracketState);
}

function mockClipServer(): void {
  return mockServer(MEDIA_DASHBOARD_PORT, nullClipState);
}

function mockServer(port: number, state: unknown): void {
  const server = new Server({ port });
  server.on('connection', ws => {
    ws.send(JSON.stringify(state));
  });
}

async function takeScreenshots(): Promise<void> {
  startServer();
  await Promise.all([
    {
      url: '/#scoreboard',
      viewport: { width: 1120, height: 250 },
      outputPath: 'docs/images/tab_scoreboard.png',
    },
    {
      url: '/#bracket',
      viewport: { width: 1120, height: 400 },
      outputPath: 'docs/images/tab_bracket.png',
    },
    {
      url: '/#twitter',
      viewport: { width: 1120, height: 360 },
      outputPath: 'docs/images/tab_twitter.png',
    },
    {
      url: '/#clips',
      viewport: { width: 1120, height: 250 },
      outputPath: 'docs/images/tab_clips.png',
    },
  ].map(takeScreenshot))
    .then(() => { /* void */ });
  exit();
}

async function takeScreenshot({
  url,
  viewport,
  outputPath,
}: {
  url: string;
  viewport: { width: number, height: number };
  outputPath: string;
}): Promise<void> {
  const browser = await puppeteer.launch({
    defaultViewport: viewport,
  });
  const page = await browser.newPage();
  const fullUrl = `http://localhost:${PORT}${url}`;
  console.log(`Opening ${fullUrl}`);
  await page.goto(fullUrl);
  console.log(`Saving ${outputPath}`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath });
  await browser.close();
}

takeScreenshots();
