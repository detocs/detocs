import { getLogger } from 'log4js';
const logger = getLogger('output/scorebaord-assistant');

import * as WebSocket from 'ws';

import LowerThird from '../../../models/lower-third';
import Scoreboard from '../../../models/scoreboard';

import State from '../state';

import Output from './output';


const PORT = 58341;

interface ScoreboardAssistantData {
  'tabID': string;
  'player1': string;
  'player2': string;
  'score1': string;
  'score2': string;
  'match': string;
  'game': string;
}

export default class ScoreboardAssistant implements Output {
  private readonly server: WebSocket.Server;
  private lastScoreboard?: ScoreboardAssistantData;
  private lastLowerThird?: ScoreboardAssistantData;

  public constructor() {
    logger.info(`Initializing Scoreboard Assistant adapter on port ${PORT}`);
    this.server = new WebSocket.Server({ port: PORT });

    this.server.on('connection', (ws, req) => {
      logger.info(`New client; Address: ${req.connection.remoteAddress}
User Agent: ${req.headers['user-agent']}`);
      this.lastScoreboard && sendData(ws, this.lastScoreboard);
      this.lastLowerThird && sendData(ws, this.lastLowerThird);
    });
  }

  public updateScoreboard(state: State): void {
    const converted = convertToScoreboard(state);
    this.lastScoreboard = converted;
    this.broadcast(converted);
  }

  public updateLowerThird(state: State): void {
    const converted = convertToLowerThird(state);
    this.lastLowerThird = converted;
    this.broadcast(converted);
  }

  private broadcast(converted: ScoreboardAssistantData): void {
    logger.debug(`Sending update:\n`, converted);
    this.server.clients.forEach(client => {
      sendData(client, converted);
    });
  }
}

function sendData(client: any, data: ScoreboardAssistantData): void {
  // TODO: What's up with the parameter types?
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }
  const json = JSON.stringify(data);
  client.send(json);
}

function convertToScoreboard(state: State): ScoreboardAssistantData {
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

function convertToLowerThird(state: State): ScoreboardAssistantData {
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

function getPlayerStrings(list: Scoreboard['players']): string[] {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const player = list[i];
    const person = player.person;
    const handle = removeVerticalBars(person.handle);
    const prefix = person.prefix ? ` | ${removeVerticalBars(person.prefix)}` : '';
    const comment = player.comment ? ` (${player.comment})` : '';
    const loser = player.inLosers ? ' [L]' : '';
    players.push(`${handle}${comment}${loser}${prefix}`);
  }
  return players;
}

function getCommentatorStrings(list: LowerThird['commentators']): string[] {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const player = list[i];
    const person = player.person;
    const handle = removeVerticalBars(person.handle);
    const prefix = person.prefix ? ` | ${removeVerticalBars(person.prefix)}` : '';
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
  return str.replace('|', ' ');
}
