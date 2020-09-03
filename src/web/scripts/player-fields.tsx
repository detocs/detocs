import { h, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { nullPerson } from '@models/person';
import { inputHandler, INTERACTIVE_SELECTOR } from '@util/dom';

import Icon from './icon';
import { PersistentCheckbox } from './persistent-checkbox';
import { PersonFieldInput, PersonSelector, PersonFieldProps } from './person-fields';
import TextInput from './text-input';

export type Props = PersonFieldProps & {
  index: number;
  score: number;
  onUpdateScore: StateUpdater<number>;
  inLosers: boolean;
  onUpdateInLosers: StateUpdater<boolean | undefined>;
  comment: string;
  onUpdateComment: StateUpdater<string | undefined>;
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
}: Props): VNode {
  const toggleInLosers = onUpdateInLosers.bind(null, !inLosers);
  const changeComment = inputHandler(onUpdateComment);
  const changeScore = inputHandler(val => onUpdateScore(parseInt(val)));
  const reset = resetPlayer.bind(
    null,
    onUpdatePerson,
    onUpdateScore,
    onUpdateInLosers,
    onUpdateComment,
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
              fieldName="prefix"
              prefix={prefix}
              person={person}
              onUpdatePerson={onUpdatePerson}
            />
            <details>
              <summary>
                <span class="details--closed"><Icon name="more" label="More" /></span>
                <span class="details--open"> Additional Fields</span>
              </summary>
              <div class="input-row">
                {[ 'handle', 'alias', 'twitter' ].map(fieldName =>
                  <PersonFieldInput
                    fieldName={fieldName}
                    prefix={prefix}
                    person={person}
                    onUpdatePerson={onUpdatePerson}
                  />
                )}
              </div>
            </details>
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
        <input
          type="number"
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
  event: UIEvent,
): void {
  personUpdater(nullPerson);
  scoreUpdater(0);
  inLosersUpdater(false);
  commentUpdater('');
  const button = event.target as HTMLButtonElement;
  button?.closest('fieldset')
    ?.querySelector<HTMLInputElement>(INTERACTIVE_SELECTOR)
    ?.focus();
}
