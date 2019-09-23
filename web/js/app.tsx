import { h, render, FunctionalComponent, ComponentChild, Fragment } from 'preact';

import InfoState, { nullState as nullInfoState } from '../../server/info/state';
import RecordingState, { nullState as nullRecordingState } from '../../server/recording/state';
import TwitterState, { nullState as nullTwitterState } from '../../server/twitter/client-state';
import { massagedFormData } from '../../util/forms';
import { getVersion } from "../../util/meta";

import { useServerState } from './hooks/server-state';
import { useToggle } from './hooks/toggle';

import { infoEndpoint, twitterEndpoint, recordingEndpoint } from './api';
import CommentaryDashboard from './commentary-dashboard';
import GameFieldsElement from './game-fields';
import MatchFieldsElement from './match-fields';
import { PersistentCheckboxElement } from './persistent-checkbox';
import PlayerDashboard from './player-dashboard';
import RecordingDashboard from './recording-dashboard';
import Tab from './tab';
import TabController from './tab-controller';
import TwitterDashboard from './twitter-dashboard';

customElements.define('game-fields', GameFieldsElement);
customElements.define('match-fields', MatchFieldsElement);
customElements.define('persistent-checkbox', PersistentCheckboxElement, { extends: 'input' });

document.addEventListener('DOMContentLoaded', () => {
  render(<App />, document.body);

  bindForms('.js-scoreboard', '/scoreboard');
  bindForms('.js-lowerthird', '/lowerthird');
});

const version = getVersion();

const App: FunctionalComponent<{}> = () => {
  const [ infoState, updateInfoState ] = useServerState<InfoState>(
    infoEndpoint('', 'ws:'),
    nullInfoState,
  );
  const [ recordingState ] = useServerState<RecordingState>(
    recordingEndpoint('', 'ws:'),
    nullRecordingState,
  );
  const [ twitterState, updateTwitterState ] = useServerState<TwitterState>(
    twitterEndpoint('', 'ws:'),
    nullTwitterState,
  );
  const [ twitterThread, toggleTwitterThread ] = useToggle(false);

  return (
    <Fragment>
      <TabController>
        <Tab id="scoreboard">
          <PlayerDashboard state={infoState} updateState={updateInfoState}/>
        </Tab>
        <Tab id="commentary">
          <CommentaryDashboard state={infoState} updateState={updateInfoState}/>
        </Tab>
        <Tab id="recording">
          <RecordingDashboard {...recordingState}/>
        </Tab>
        <Tab id="twitter">
          <TwitterDashboard
            {...twitterState}
            thread={twitterThread}
            onThreadToggle={toggleTwitterThread}
          />
        </Tab>
      </TabController>
      <footer id="version">DETOCS {version}</footer>
    </Fragment>
  );
}

function bindForms(formSelector: string, endpoint: string): void {
  const forms = document.querySelectorAll(formSelector) as NodeListOf<HTMLFormElement>;
  for (const form of forms) {
    bindForm(form, endpoint);
  }
}

function bindForm(form: HTMLFormElement, endpoint: string): void {
  form.onsubmit = (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    let data = new FormData(form);
    data = massagedFormData(data);
    fetch(infoEndpoint(endpoint).href, { method: 'POST', body: data })
      .catch(console.error);
  };
}
