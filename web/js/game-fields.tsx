import { h, render, Component, ComponentChild } from 'preact';

import Game, { nullGame } from '../../models/game';

import { infoEndpoint } from './api';

export default class GameFieldsElement extends HTMLElement {
  private connectedCallback(): void {
    render(<GameFields />, this);
  }
}

interface GameFieldsState {
  game: Game;
  gameList: Game[];
}

const idRegex = /\{(\w+)\}/;
let idCounter = 0;

class GameFields extends Component<{}, GameFieldsState> {
  private readonly autocompleteId: string;

  public constructor() {
    super();
    this.state = {
      game: nullGame,
      gameList: [],
    };
    this.autocompleteId = `game-fields-${idCounter++}`;

    this.loadGameList();
    const ws = new WebSocket(infoEndpoint('', 'ws:').href);
    ws.onmessage = this.receiveServerUpdate.bind(this);
    ws.onerror = console.error;
  }

  private loadGameList(): void {
    fetch(infoEndpoint('/games').href)
      .catch(console.error)
      .then(resp => resp && resp.json())
      .then(games => this.setState({ gameList: games }));
  }

  private receiveServerUpdate(ev: MessageEvent): void {
    const newGame = JSON.parse(ev.data) as Game;
    this.updateGame(newGame);
  }

  private getGame(id: string): Game {
    return this.state.gameList
      .find(g => g.id === id) ||
      nullGame;
  }

  private updateGame(newGame: Game): void {
    this.setState({ game: newGame });
  }

  private handleInput = (event: Event): void => {
    const value = (event.target as HTMLInputElement).value;
    const match = idRegex.exec(value);
    if (match) {
      const id = match[1];
      this.updateGame(this.getGame(id));
      return;
    }
    this.updateGame({
      id: '',
      name: value,
      shortNames: [],
      hashtags: [],
    });
  };

  public render(_: unknown, state: GameFieldsState): ComponentChild {
    return (
      <fieldset name="game">
        <legend>Game</legend>
        <div class="input-row">
          <input
            type="hidden"
            name="game[id]"
            value={state.game.id}
          />
          <input
            type="text"
            name="game[name]"
            value={state.game.name}
            onInput={this.handleInput}
            list={this.autocompleteId}
            placeholder="Game"
          />
          <datalist id={this.autocompleteId}>
            {state.gameList.map(g => <option value={`{${g.id}}`}>{g.name}</option>)}
          </datalist>
        </div>
      </fieldset>
    );
  }
}
