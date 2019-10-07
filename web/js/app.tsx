import { h, render, FunctionalComponent, VNode, Fragment } from 'preact';

import InfoState, { nullState as nullInfoState } from '../../server/info/state';
import RecordingState, { nullState as nullRecordingState } from '../../server/recording/state';
import TwitterState, { nullState as nullTwitterState } from '../../server/twitter/client-state';
import { massagedFormData } from '../../util/forms';
import { getVersion } from "../../util/meta";

import { useServerState } from './hooks/server-state';
import { useToggle } from './hooks/toggle';

import { infoEndpoint, twitterEndpoint, recordingEndpoint } from './api';
import BreakDashboard from './break-dashboard';
import CommentaryDashboard from './commentary-dashboard';
import PlayerDashboard from './player-dashboard';
import RecordingDashboard from './recording-dashboard';
import Tab from './tab';
import TabController from './tab-controller';
import TwitterDashboard from './twitter-dashboard';

document.addEventListener('DOMContentLoaded', () => {
  render(<App />, document.body);
  bindSubmitHandler();
});

const version = getVersion();

const App: FunctionalComponent<{}> = (): VNode => {
  const [ infoState, updateInfoState ] = useServerState<InfoState>(
    infoEndpoint('', 'ws:'),
    nullInfoState,
  );
  const [ recordingState, updateRecordingState ] = useServerState<RecordingState>(
    recordingEndpoint('', 'ws:'),
    nullRecordingState,
  );
  const [ twitterState ] = useServerState<TwitterState>(
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
          <RecordingDashboard state={recordingState} updateState={updateRecordingState}/>
        </Tab>
        <Tab id="twitter">
          <TwitterDashboard
            {...twitterState}
            thread={twitterThread}
            onThreadToggle={toggleTwitterThread}
          />
        </Tab>
        <Tab id="break">
          <BreakDashboard state={infoState} updateState={updateInfoState}/>
        </Tab>
      </TabController>
      <footer id="version">DETOCS {version}</footer>
    </Fragment>
  );
};

function bindSubmitHandler(): void {
  document.addEventListener('submit', (event: Event) => {
    const form = event.target as HTMLFormElement;
    let data = new FormData(form);
    data = massagedFormData(data);
    fetch(form.action, {
      method: form.method,
      body: data,
    }).catch(console.error);

    event.preventDefault();
  });
}
