import { getLogger } from '@util/logger';

import * as WebSocket from 'ws';

import { sendData, broadcastData } from '@util/websocket';

import State from '@server/info/state';

import Output, { OutputState, toOutputState } from './output';

const logger = getLogger('output/scorebaord-assistant');
const PORT = 58341;

interface ScoreboardAssistantScoreboard {
  'tabID': string;
  'player1': string;
  'player2': string;
  'score1': string;
  'score2': string;
  'match': string;
  'game': string;
}

interface ScoreboardAssistantText {
  'tabID': string;
  'text1': string;
  'text2': string;
  'text3': string;
  'text4': string;
}

// TODO: Replace with Default output (file/websocket)
export default class ScoreboardAssistant implements Output {
  private server: WebSocket.Server | undefined;
  private lastScoreboard?: ScoreboardAssistantScoreboard;
  private lastLowerThird?: ScoreboardAssistantScoreboard;
  private lastBreak?: ScoreboardAssistantText;

  public async init(): Promise<void> {
    logger.info(`Initializing Scoreboard Assistant adapter on port ${PORT}`);
    this.server = new WebSocket.Server({ port: PORT });

    this.server.on('connection', (ws, req) => {
      logger.info(`New client; Address: ${req.connection.remoteAddress}
User Agent: ${req.headers['user-agent']}`);
      this.lastScoreboard && sendData(ws as WebSocket, this.lastScoreboard);
      this.lastLowerThird && sendData(ws as WebSocket, this.lastLowerThird);
      this.lastBreak && sendData(ws as WebSocket, this.lastBreak);
    });
  }

  public update(state: State): void {
    const outputState = toOutputState(state);

    const convertedScoreboard = convertToScoreboard(outputState);
    this.lastScoreboard = convertedScoreboard;
    this.broadcast(convertedScoreboard);

    const convertedLowerThird = convertToLowerThird(outputState);
    this.lastLowerThird = convertedLowerThird;
    this.broadcast(convertedLowerThird);

    const convertedBreak = convertToBreak(outputState);
    this.lastBreak = convertedBreak;
    this.broadcast(convertedBreak);
  }

  private broadcast(converted: ScoreboardAssistantScoreboard | ScoreboardAssistantText): void {
    if (!this.server) {
      throw new Error('Server not initialized');
    }
    logger.debug(`Sending update:\n`, converted);
    broadcastData(this.server, converted);
  }
}

function convertToScoreboard(state: OutputState): ScoreboardAssistantScoreboard {
  const players = getPlayerStrings(state.players);
  return {
    'tabID': mapTabId(state.game.id),
    'player1': players[0],
    'player2': players[1],
    'score1': state.players[0].score.toString(),
    'score2': state.players[1].score.toString(),
    'match': state.match.name,
    'game': state.tournament,
  };
}

function convertToLowerThird(state: OutputState): ScoreboardAssistantScoreboard {
  const players = getCommentatorStrings(state.commentators);
  return {
    'tabID': 'commentators',
    'player1': players[0],
    'player2': players[1],
    'score1': '0',
    'score2': '0',
    'match': state.tournament,
    'game': state.event || state.game.name,
  };
}

function convertToBreak(state: OutputState): ScoreboardAssistantText {
  return {
    'tabID': 'break',
    'text1': state.messages[0],
    'text2': state.messages[1],
    'text3': state.messages[2],
    'text4': state.messages[3],
  };
}

function getPlayerStrings(list: OutputState['players']): string[] {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const player = list[i];
    const person = player.person;
    const handle = removeVerticalBars(person.handle);
    const prefix = person.prefix ? ` || ${removeVerticalBars(person.prefix)}` : '';
    const comment = player.comment ? ` (${player.comment})` : '';
    const loser = player.inLosers ? ' [L]' : '';
    players.push(`${handle}${comment}${loser}${prefix}`);
  }
  return players;
}

function getCommentatorStrings(list: OutputState['commentators']): string[] {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const player = list[i];
    const person = player.person;
    const handle = removeVerticalBars(person.handle);
    const prefix = person.prefix ? ` || ${removeVerticalBars(person.prefix)}` : '';
    const twiter = person.twitter ? ` @${person.twitter}` : '';
    players.push(`${handle}${prefix}${twiter}`);
  }
  return players;
}

const tabIdMapping: Record<string, string> = {
  'uni': 'unist',
  'kof13': 'kof',
  'bbcf': 'bb',
};
function mapTabId(tabId: string): string {
  return tabIdMapping[tabId] || tabId;
}

function removeVerticalBars(str: string): string {
  return str.replace('||', '|');
}
