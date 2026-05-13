import updateImmutable from 'immutability-helper';
import { ComponentChild, h, VNode } from 'preact';
import { StateUpdater, useEffect, useRef } from 'preact/hooks';

import GameCharacter from '@models/game-character.ts';
import GameTeam from '@models/game-team.ts';
import Game from '@models/game.ts';
import { INTERACTIVE_SELECTOR } from '@util/dom.ts';
import { submitOnEnter } from '@util/forms.ts';

import Icon from './icon.tsx';

export function TeamEditor({
  prefix, teams, onUpdateTeams, teamsLength, onUpdateTeamsLength, game,
}: {
  prefix: string;
  teams: GameTeam[];
  onUpdateTeams: StateUpdater<GameTeam[] | undefined>;
  teamsLength: number;
  onUpdateTeamsLength: StateUpdater<number>;
  game: Game;
}): VNode | null {
  useEffect(() => {
    onUpdateTeamsLength(teams.length);
  }, [teams.length, game.id, onUpdateTeamsLength]);

  const rowRef = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (rowRef.current && focusIndexRef.current != null) {
      const addButton = rowRef.current.querySelector<HTMLButtonElement>('.js-add-team');
      if (focusIndexRef.current == -1) {
        addButton?.focus();
      } else {
        const teamElem = rowRef.current.querySelector<HTMLSelectElement>(
          `.js-team:nth-child(${focusIndexRef.current + 1}) :is(${INTERACTIVE_SELECTOR})`
        );
        (teamElem || addButton)?.focus();
      }
      focusIndexRef.current = null;
    }
  });

  if (!game.characters?.length) {
    return null;
  }

  const numCharacters = game?.teamSize || 1;
  const charOptions = [<option value="">[Character]</option>].concat(
    (game?.characters || [])
      .map(char => <option value={char.id}>{char.name}</option>)
  );

  const setChar = function (teamIdx: number, charIdx: number, charId: string): void {
    onUpdateTeams(teams => {
      const filledTeams = fillTeams(teams || [], teamIdx);
      const filledChars = fillChars(filledTeams, teamIdx, charIdx);
      return updateImmutable(
        filledChars,
        {
          [teamIdx]: {
            characters: {
              [charIdx]: {
                id: {
                  $set: charId,
                },
              },
            },
          },
        }
      );
    });
  };
  const setCharOption = function (
    teamIdx: number,
    charIdx: number,
    configId: string,
    value: string
  ): void {
    onUpdateTeams(teams => {
      const filledTeams = fillTeams(teams || [], teamIdx);
      const filledChars = fillChars(filledTeams, teamIdx, charIdx);
      return updateImmutable(
        filledChars,
        {
          [teamIdx]: {
            characters: {
              [charIdx]: {
                options: {
                  $apply: (opts: GameCharacter['options']) => Object.assign({}, opts, { [configId]: value }),
                },
              },
            },
          },
        }
      );
    });
  };
  const setTeamOption = function (
    teamIdx: number,
    configId: string,
    value: string
  ): void {
    onUpdateTeams(teams => {
      const filledTeams = fillTeams(teams || [], teamIdx);
      return updateImmutable(
        filledTeams,
        {
          [teamIdx]: {
            options: {
              $apply: (opts: GameTeam['options']) => Object.assign({}, opts, { [configId]: value }),
            },
          },
        }
      );
    });
  };
  const removeTeam = function (teamIdx: number): void {
    onUpdateTeams(teams => {
      const newTeams = teams ? teams.slice() : [];
      newTeams.splice(teamIdx, 1);
      return newTeams;
    });
  };

  const editorTeams = [...teams];
  for (let i = 0; i < teamsLength - teams.length; i++) {
    editorTeams.push({ characters: [] });
  }
  return (
    <fieldset name="characters" class="team-editor">
      <legend>Characters</legend>
      <div class="input-row" ref={rowRef}>
        {editorTeams.map((team, idx) => {
          const chars = range(numCharacters)
            .map(i => team.characters[i] || { id: '' })
            .map((char, idx2) => (
              <span class="team-editor__char">
                <select
                  name={char.id ? `${prefix}[teams][${idx}][characters][${idx2}][id]` : undefined}
                  value={char.id}
                  onChange={e => setChar(idx, idx2, (e.target as HTMLSelectElement).value)}
                  onKeyDown={submitOnEnter}
                >
                  {charOptions}
                </select>
                {game.characterConfigs && game.characterConfigs.map(config => (
                  <select
                    name={char.id ? `${prefix}[teams][${idx}][characters][${idx2}][options][${config.id}]` : undefined}
                    value={char.options?.[config.id] || ''}
                    onChange={e => setCharOption(
                      idx,
                      idx2,
                      config.id,
                      (e.target as HTMLSelectElement).value
                    )}
                    onKeyDown={submitOnEnter}
                  >
                    {[<option value="">{`[${config.name}]`}</option>].concat(
                      config.options.map(option => <option value={option.id}>{option.name}</option>)
                    )}
                  </select>
                ))}
              </span>
            ));
          return (
            <span class="team-editor__team js-team">
              {joinNodes(chars, ' / ')}
              {game.teamConfigs && game.teamConfigs.map(config => (
                <select
                  name={`${prefix}[teams][${idx}][options][${config.id}]`}
                  value={team.options?.[config.id] || ''}
                  onChange={e => setTeamOption(
                    idx,
                    config.id,
                    (e.target as HTMLSelectElement).value
                  )}
                  onKeyDown={submitOnEnter}
                >
                  {[<option value="">{`[${config.name}]`}</option>].concat(
                    config.options.map(option => <option value={option.id}>{option.name}</option>)
                  )}
                </select>
              ))}
              <button
                type="button"
                class="warning"
                onClick={() => {
                  focusIndexRef.current = Math.max(idx - 1, 0);
                  removeTeam(idx);
                  onUpdateTeamsLength(n => n - 1);
                }}
              >
                <Icon name="minus" />
              </button>
              {idx < editorTeams.length - 1 ? ', ' : null}
            </span>
          );
        })}
        <button
          type="button"
          class="team-editor__add-team js-add-team"
          onClick={() => onUpdateTeamsLength(n => {
            focusIndexRef.current = n;
            return n + 1;
          })}
        >
          <Icon name="plus" />
        </button>
      </div>
    </fieldset>
  );
}

function fillTeams(teams: GameTeam[], teamIdx: number): GameTeam[] {
  if (teamIdx < teams.length) {
    return teams;
  }
  return updateImmutable(
    teams,
    {
      $push: range(teamIdx + 1 - teams.length)
        .map(() => ({ characters: [] })),
    }
  );
}

function fillChars(teams: GameTeam[], teamIdx: number, charIdx: number): GameTeam[] {
  if (charIdx < teams[teamIdx].characters.length) {
    return teams;
  }
  return updateImmutable(
    teams,
    {
      [teamIdx]: {
        characters: {
          $push: range(charIdx + 1 - teams[teamIdx].characters.length)
            .map(() => ({ id: '' })),
        }
      },
    }
  );
}

function range(count: number): number[] {
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, i) => i);
}

function joinNodes(nodes: VNode[], node: ComponentChild): ComponentChild[] {
  return nodes.reduce((acc, curr) => {
    if (acc.length > 0) {
      acc.push(node);
    }
    acc.push(curr);
    return acc;
  }, [] as ComponentChild[]);
}
