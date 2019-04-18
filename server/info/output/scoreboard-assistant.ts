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
  'score1': number;
  'score2': number;
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
      logger.info(`New client; Address: ${req.connection.remoteAddress}\nUser Agent: ${req.headers['user-agent']}`);
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
  const player1Handle = removeVerticalBars(scoreboard.players[0].person.handle);
  const player1Sponsor = removeVerticalBars(scoreboard.players[0].person.prefix);
  const player2Handle = removeVerticalBars(scoreboard.players[1].person.handle);
  const player2Sponsor = removeVerticalBars(scoreboard.players[1].person.prefix);
  return {
    'tabID': 'unist',
    'player1': `${player1Handle} | ${player1Sponsor}`,
    'player2': `${player2Handle} | ${player2Sponsor}`,
    'score1': scoreboard.players[0].score,
    'score2': scoreboard.players[1].score,
    'match': scoreboard.match,
    'game': scoreboard.game,
  };
}

function removeVerticalBars(str: string): string {
  return str.replace('|', ' ');
}
