import { h, Component, ComponentChild } from "preact";

import { PersistentCheckbox } from "./persistent-checkbox";
import PersonFields, { Props as PersonFieldsProps } from "./person-fields";

export type Props = PersonFieldsProps & {
  index: number;
  score: number;
  onUpdateScore: (score: number) => void;
  inLosers: boolean;
  onUpdateInLosers: (inLosers: boolean) => void;
  comment: string;
  onUpdateComment: (comment: string) => void;
};

export default class PlayerFields extends Component<Props, {}> {
  private toggleInLosers = (): void => {
    this.props.onUpdateInLosers(!this.props.inLosers);
  };

  private changeComment = (e: Event): void => {
    this.props.onUpdateComment((e.target as HTMLInputElement).value);
  };

  private changeScore = (e: Event): void => {
    this.props.onUpdateScore(parseInt((e.target as HTMLInputElement).value));
  };

  public render(props: Props): ComponentChild {
    return (
      <fieldset name={`player${props.index}`} class="player js-player">
        <legend>Player {props.index + 1}</legend>
        <div class="input-row">
          <fieldset name="competitor" class="competitor">
            <legend>Competitor</legend>
            <div class="input-row">
              <PersonFields
                prefix={props.prefix}
                personFields={props.personFields}
                person={props.person}
                onUpdatePerson={props.onUpdatePerson}
              />
            </div>
          </fieldset>
          <fieldset name="extra">
            <legend>Extra</legend>
            <div class="input-row">
              <label>
                [L]
                <PersistentCheckbox
                  name={`${props.prefix}[inLosers]`}
                  checked={props.inLosers}
                  onChange={this.toggleInLosers}
                />
              </label>
              <input
                type="text"
                name={`${props.prefix}[comment]`}
                value={props.comment}
                onInput={this.changeComment}
                class="comment"
                placeholder="Comment"
              />
            </div>
          </fieldset>
          <input
            type="number"
            name={`${props.prefix}[score]`}
            value={props.score}
            onInput={this.changeScore}
            min="0"
            class="score"
          />
        </div>
      </fieldset>
    );
  }
}
