import * as WebSocket from 'ws';

import LowerThird from '../../../models/lower-third';
import Scoreboard from '../../../models/scoreboard';

import Output from './output';

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

  public updateScoreboard(scoreboard: Scoreboard): void {
    const converted = convert(scoreboard);
    this.lastScoreboard = converted;
    this.broadcast(converted);
  }

  public updateLowerThird(lowerThird: LowerThird): void {
    const converted = convert({
      players: lowerThird.commentators.map(c => ({person: c.person, score: 0})),
      match: { id: '', name: lowerThird.tournament, smashggId: null },
      game: { id: 'commentators', name: lowerThird.event, shortNames: [], hashtags: [] },
    });
    this.lastLowerThird = converted;
    this.broadcast(converted);
  }

  private broadcast(converted: ScoreboardAssistantData): void {
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
    const person = scoreboard.players[i].person;
    const handle = removeVerticalBars(person.handle);
    let prefix = person.prefix && removeVerticalBars(person.prefix);
    prefix = prefix ? ` | ${prefix}` : '';
    const twiter =  person.twitter ? ` @${person.twitter}` : '';
    players.push(`${handle}${prefix}${twiter}`);
  }
  return {
    'tabID': mapTabId(scoreboard.game.id),
    'player1': players[0],
    'player2': players[1],
    'score1': scoreboard.players[0].score.toString(),
    'score2': scoreboard.players[1].score.toString(),
    'match': scoreboard.match.name,
    'game': scoreboard.game.name,
  };
}

const tabIdMapping: Record<string, string> = {
  'uni': 'unist',
};
function mapTabId(tabId: string): string {
  return tabIdMapping[tabId] || tabId;
}

function removeVerticalBars(str: string): string {
  return str.replace('|', ' ');
}
