import { h, Component, ComponentChild, render } from "preact";

import { PersonUpdate } from "../../models/person";

import PersonFields, { PersonFieldsProps } from "./person-fields";
import { PersistentCheckbox } from "./persistent-checkbox";

export class PlayerFieldsElement extends HTMLElement {
  private componentElement?: Element;

  public state: Props = {
    index: 0,
    prefix: 'players[]',
    personFields: ['handle', 'prefix'],
    person: {},
    onUpdatePerson: this.updatePerson.bind(this),
    score: 0,
    onUpdateScore: this.updateScore.bind(this),
    inLosers: false,
    onUpdateInLosers: this.updateInLosers.bind(this),
    comment: '',
    onUpdateComment: this.updateComment.bind(this),
  };

  private connectedCallback(): void {
    this.state.index = parseInt(this.dataset.index || '') || 0;
    this.render();
  }

  public reset(): void {
    this.state.person = {};
    this.state.score = 0;
    this.state.inLosers = false;
    this.state.comment = '';
    this.render();
  };

  public resetScore(): void {
    console.log(this.state);
    this.state.score = 0;
    this.render();
  };

  public updatePerson(person: PersonUpdate): void {
    this.state.person = person;
    this.render();
  };

  public updateScore(score: number): void {
    this.state.score = score;
    this.render();
  };

  public updateInLosers(inLosers: boolean): void {
    this.state.inLosers = inLosers;
    this.render();
  };

  public updateComment(comment: string): void {
    this.state.comment = comment;
    this.render();
  };

  public render(): void {
    this.componentElement = render(
      <PlayerFields {...this.state} />,
      this,
      this.componentElement
    );
  }
}

type Props = PersonFieldsProps & {
  index: number;
  score: number;
  onUpdateScore: (score: number) => void;
  inLosers: boolean;
  onUpdateInLosers: (inLosers: boolean) => void;
  comment: string;
  onUpdateComment: (comment: string) => void;
};
export type PlayerFieldsProps = Props;

export class PlayerFields extends Component<Props, {}> {
  private toggleInLosers = (): void => {
    this.props.onUpdateInLosers(!this.props.inLosers);
  };

  private changeComment = (e: Event): void => {
    console.log('changeComment');
    console.log((e.target as HTMLInputElement).value);
    this.props.onUpdateComment((e.target as HTMLInputElement).value);
  };

  private changeScore = (e: Event): void => {
    console.log('changeScore');
    console.log((e.target as HTMLInputElement).value);
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
