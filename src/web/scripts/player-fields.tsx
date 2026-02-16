import updateImmutable from 'immutability-helper';
import { ComponentChild, Fragment, h, VNode } from 'preact';
import { StateUpdater, useEffect } from 'preact/hooks';

import Game from '@models/game';
import GameCharacter from '@models/game-character';
import GameTeam from '@models/game-team';
import { nullPerson } from '@models/person';
import { inputHandler, INTERACTIVE_SELECTOR } from '@util/dom';
import { submitOnEnter } from '@util/forms';

import Icon from './icon';
import NumberInput from './number-input';
import { PersistentCheckbox } from './persistent-checkbox';
import {
  PersonFieldInput,
  PersonSelector,
  PersonFieldProps,
  PersonAdditionalFields,
  FieldName,
} from './person-fields';
import TextInput from './text-input';

export type Props = PersonFieldProps & {
  index: number;
  score: number;
  onUpdateScore: StateUpdater<number>;
  inLosers: boolean;
  onUpdateInLosers: StateUpdater<boolean | undefined>;
  comment: string;
  onUpdateComment: StateUpdater<string | undefined>;
  teams: GameTeam[];
  onUpdateTeams: StateUpdater<GameTeam[] | undefined>;
  teamsLength: number;
  onUpdateTeamsLength: StateUpdater<number>;
  game: Game;
};

export default function PlayerFields({
  index,
  prefix,
  person,
  onUpdatePerson,
  score,
  onUpdateScore,
  inLosers,
  onUpdateInLosers,
  comment,
  onUpdateComment,
  teams,
  onUpdateTeams,
  teamsLength,
  onUpdateTeamsLength,
  game,
}: Props): VNode {
  const toggleInLosers = onUpdateInLosers.bind(null, !inLosers);
  const changeComment = inputHandler(onUpdateComment);
  const changeScore = inputHandler(val => onUpdateScore(parseInt(val)));
  const reset = (e: UIEvent): void => resetPlayer(
    onUpdatePerson,
    onUpdateScore,
    onUpdateInLosers,
    onUpdateComment,
    onUpdateTeams,
    e,
  );

  return (
    <fieldset name={`player${index}`} class="player js-player">
      <legend>
        Player {index + 1}
        {' '}
        <button type="button" class="warning" onClick={reset}>
          Reset
        </button>
      </legend>
      <div class="input-row">
        <fieldset name="competitor" class="competitor">
          <legend>Competitor</legend>
          <div class="input-row">
            <PersonSelector
              prefix={prefix}
              person={person}
              onUpdatePerson={onUpdatePerson}
            />
            <PersonFieldInput
              fieldName={FieldName.Prefix}
              prefix={prefix}
              person={person}
              onUpdatePerson={onUpdatePerson}
            />
            <PersonAdditionalFields>
              {[
                [ FieldName.Handle, FieldName.Alias, FieldName.Pronouns ],
                [ FieldName.Country, FieldName.State, FieldName.City ],
                [ FieldName.Twitter ],
              ].map(fieldNames =>
                <div class="input-row">
                  {fieldNames.map(fieldName =>
                    <PersonFieldInput
                      fieldName={fieldName}
                      prefix={prefix}
                      person={person}
                      onUpdatePerson={onUpdatePerson}
                    />
                  )}
                </div>
              )}
            </PersonAdditionalFields>
          </div>
        </fieldset>
        <fieldset name="extra">
          <legend>Extra</legend>
          <div class="input-row">
            <label>
              [L]
              <PersistentCheckbox
                name={`${prefix}[inLosers]`}
                checked={inLosers}
                onChange={toggleInLosers}
              />
            </label>
            <TextInput
              name={`${prefix}[comment]`}
              value={comment}
              onInput={changeComment}
              class="comment"
              label="Comment"
            />
          </div>
        </fieldset>
        <TeamEditor
          prefix={prefix}
          teams={teams}
          onUpdateTeams={onUpdateTeams}
          teamsLength={teamsLength}
          onUpdateTeamsLength={onUpdateTeamsLength}
          game={game}
        />
        <NumberInput
          name={`${prefix}[score]`}
          value={score}
          onInput={changeScore}
          min="0"
          class="score"
        />
      </div>
    </fieldset>
  );
}

function TeamEditor({
  prefix,
  teams,
  onUpdateTeams,
  teamsLength,
  onUpdateTeamsLength,
  game,
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

  if (!game.characters?.length) {
    return null;
  }

  const numCharacters = game?.teamSize || 1;
  const charOptions = [<option value="">[Character]</option>].concat(
    (game?.characters || [])
      .map(char => <option value={char.id}>{char.name}</option>)
  );

  // TODO: Use immutability-helper throughout
  const setChar = function(teamIdx: number, charIdx: number, charId: string): void {
    onUpdateTeams(teams => {
      const newTeams = teams ? teams.slice() : [];
      while (newTeams.length <= teamIdx) {
        newTeams.push({ characters: [] });
      }
      const team = Object.assign({}, newTeams[teamIdx]);
      const characters = team.characters.slice();
      while (characters.length <= charIdx) {
        characters.push({ id: '' });
      }
      const character = Object.assign({}, characters[charIdx]);
      character.id = charId;
      characters[charIdx] = character;
      team.characters = characters;
      newTeams[teamIdx] = team;
      return newTeams;
    });
  };
  const setCharOption = function(
    teamIdx: number,
    charIdx: number,
    configId: string,
    value: string,
  ): void {
    onUpdateTeams(teams => {
      const filledTeams = updateImmutable(
        teams,
        {
          $push: range(teamIdx + 1 - (teams?.length || 0))
            .map(() => ({ characters: [] })),
        }
      );
      const filledChars = updateImmutable(
        filledTeams,
        {
          [teamIdx]: {
            characters: {
              $push: range(charIdx + 1 - (filledTeams?.[teamIdx]?.characters.length || 0))
                .map(() => ({ id: '' })),
            }
          },
        }
      );
      return updateImmutable(
        filledChars,
        {
          [teamIdx]: {
            characters: {
              [charIdx]: {
                options: {
                  $apply: (opts: GameCharacter['options']) => Object.assign({}, opts, { [configId]: value })
                }
              },
            }
          },
        }
      );
    });
  };
  const setTeamOption = function(
    teamIdx: number,
    configId: string,
    value: string,
  ): void {
    onUpdateTeams(teams => {
      const newTeams = teams ? teams.slice() : [];
      while (newTeams.length <= teamIdx) {
        newTeams.push({ characters: [] });
      }
      const team = Object.assign({}, newTeams[teamIdx]);
      team.options = team.options || {};
      team.options[configId] = value;
      newTeams[teamIdx] = team;
      return newTeams;
    });
  };
  const removeTeam = function(teamIdx: number): void {
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
    <fieldset name="characters">
      <legend>Characters</legend>
      <div class="input-row">
        {editorTeams.map((team, idx) => {
          const chars = range(numCharacters)
            .map(i => team.characters[i] || { id: '' })
            .map((char, idx2) => (
              <Fragment>
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
                      (e.target as HTMLSelectElement).value,
                    )}
                    onKeyDown={submitOnEnter}
                  >
                    {[<option value="">{`[${config.name}]`}</option>].concat(
                      config.options.map(option => <option value={option.id}>{option.name}</option>)
                    )}
                  </select>
                ))}
              </Fragment>
            ));
          return (
            <Fragment>
              {joinNodes(chars, '/')}
              {game.teamConfigs && game.teamConfigs.map(config => (
                <select
                  name={`${prefix}[teams][${idx}][options][${config.id}]`}
                  value={team.options?.[config.id] || ''}
                  onChange={e => setTeamOption(
                    idx,
                    config.id,
                    (e.target as HTMLSelectElement).value,
                  )}
                  onKeyDown={submitOnEnter}
                >
                  {[<option value="">{`[${config.name}]`}</option>].concat(
                    config.options.map(option => <option value={option.id}>{option.name}</option>)
                  )}
                </select>
              ))}
              <button type="button" onClick={() => removeTeam(idx)}><Icon name="minus" /></button>
            </Fragment>
          );
        })}
        <button type="button" onClick={() => onUpdateTeamsLength(n => n+1)}><Icon name="plus" /></button>
      </div>
    </fieldset>
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

function resetPlayer(
  personUpdater: Props['onUpdatePerson'],
  scoreUpdater: Props['onUpdateScore'],
  inLosersUpdater: Props['onUpdateInLosers'],
  commentUpdater: Props['onUpdateComment'],
  teamsUpdater: Props['onUpdateTeams'],
  event: UIEvent,
): void {
  personUpdater(nullPerson);
  scoreUpdater(0);
  inLosersUpdater(false);
  commentUpdater('');
  teamsUpdater([]);
  const button = event.target as HTMLButtonElement;
  button?.closest('fieldset')
    ?.querySelector<HTMLInputElement>(INTERACTIVE_SELECTOR)
    ?.focus();
}
