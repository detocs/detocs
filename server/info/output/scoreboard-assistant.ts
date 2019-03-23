import * as WebSocket from 'ws';

import Output from './output';
import Match from '../../../models/match';

import { getLogger } from 'log4js';
const logger = getLogger('output/scorebaord-assistant');

const PORT = 58341;

interface ScoreboardAssistantMatch {

}

export default class ScoreboardAssistant implements Output {
  private readonly server: WebSocket.Server;
  private lastMatch?: string;

  constructor() {
    logger.info(`Initializing Scoreboard Assistant adapter on port ${PORT}`);
    this.server = new WebSocket.Server({ port: PORT });

    this.server.on('connection', (ws, req) => {
      logger.info(`New client; Address: ${req.connection.remoteAddress}\nUser Agent: ${req.headers['user-agent']}`);
      if (this.lastMatch) {
        sendMatch(ws, this.lastMatch);
      }
    });
  }

  match(match: Match): void {
    const converted = convert(match);
    this.lastMatch = converted;
    this.server.clients.forEach(client => {
      sendMatch(client, converted);
    });
  }
}

function sendMatch(client: any, match: string): any {
  // TODO: What's up with the parameter types?
  if (client.readyState === WebSocket.OPEN) {
    logger.debug(`Sending match:\n${match}`);
    client.send(match);
  }
}

function convert(match: Match): string {
  const player1Handle = removeVerticalBars(match.players[0].person.handle);
  const player1Sponsor = removeVerticalBars(match.players[0].person.sponsor);
  const player2Handle = removeVerticalBars(match.players[1].person.handle);
  const player2Sponsor = removeVerticalBars(match.players[1].person.sponsor);
  return JSON.stringify({
    'tabID': 'unist',
    'player1': `${player1Handle} | ${player1Sponsor}`,
    'player2': `${player2Handle} | ${player2Sponsor}`,
    'score1': match.players[0].score,
    'score2': match.players[1].score,
    'match': '',
    'game': '',
  })
}

function removeVerticalBars(str: string): string {
  return str.replace('|', ' ');
}
