import { h, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import Game from '@models/game.ts';
import GameTeam from '@models/game-team.ts';
import { nullPerson } from '@models/person.ts';
import { inputHandler, INTERACTIVE_SELECTOR } from '@util/dom.ts';

import NumberInput from './number-input.tsx';
import { PersistentCheckbox } from './persistent-checkbox.tsx';
import {
  PersonFieldInput,
  PersonSelector,
  PersonFieldProps,
  PersonAdditionalFields,
  FieldName,
} from './person-fields.tsx';
import { TeamEditor } from './team-editor.tsx';
import TextInput from './text-input.tsx';

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
  addlFieldsOpen: boolean;
  setAddlFieldsOpen: StateUpdater<boolean>;
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
  addlFieldsOpen,
  setAddlFieldsOpen,
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
      <div class="player__container">
        <div class="player__fields input-row">
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
              <PersonAdditionalFields
                isOpen={addlFieldsOpen}
                updateOpen={setAddlFieldsOpen}
              >
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
        </div>
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
