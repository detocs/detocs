import * as WebSocket from 'ws';

import Output from './output';
import Scoreboard from '../../../models/scoreboard';

import { getLogger } from 'log4js';
const logger = getLogger('output/scorebaord-assistant');

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
  private lastMatch?: ScoreboardAssistantData;

  public constructor() {
    logger.info(`Initializing Scoreboard Assistant adapter on port ${PORT}`);
    this.server = new WebSocket.Server({ port: PORT });

    this.server.on('connection', (ws, req) => {
      logger.info(`New client; Address: ${req.connection.remoteAddress}
User Agent: ${req.headers['user-agent']}`);
      if (this.lastMatch) {
        sendData(ws, this.lastMatch);
      }
    });
  }

  public update(scoreboard: Scoreboard): void {
    const converted = convert(scoreboard);
    this.lastMatch = converted;
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
  logger.debug(`Sending update:\n`, data);
  const json = JSON.stringify(data);
  client.send(json);
}

function convert(scoreboard: Scoreboard): ScoreboardAssistantData {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const handle = removeVerticalBars(scoreboard.players[i].person.handle);
    let prefix = scoreboard.players[i].person.prefix;
    prefix = prefix && removeVerticalBars(prefix);
    prefix = prefix ? ` | ${prefix}` : '';
    players.push(`${handle}${prefix}`);
  }
  return {
    'tabID': 'unist',
    'player1': players[0],
    'player2': players[1],
    'score1': scoreboard.players[0].score.toString(),
    'score2': scoreboard.players[1].score.toString(),
    'match': scoreboard.match,
    'game': scoreboard.game,
  };
}

function removeVerticalBars(str: string): string {
  return str.replace('|', ' ');
}
