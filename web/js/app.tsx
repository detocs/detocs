import { h, render, FunctionalComponent, VNode, Fragment } from 'preact';

import BracketState, { nullState as nullBracketState } from '../../server/bracket/state';
import InfoState, { nullState as nullInfoState } from '../../server/info/state';
import {
  State as MediaState,
  nullState as nullMediaState
} from '../../server/media-dashboard/state';
import RecordingState, { nullState as nullRecordingState } from '../../server/recording/state';
import TwitterState, { nullState as nullTwitterState } from '../../server/twitter/client-state';
import { massagedFormData } from '../../util/forms';
import { getVersion } from "../../util/meta";

import { useServerState } from './hooks/server-state';
import { useToggle } from './hooks/toggle';

import {
  infoEndpoint,
  twitterEndpoint,
  recordingEndpoint,
  bracketEndpoint,
  mediaDashboardEndpoint
} from './api';
import BracketDashboard from './bracket-dashboard';
import BreakDashboard from './break-dashboard';
import CommentaryDashboard from './commentary-dashboard';
import PlayerDashboard from './player-dashboard';
import RecordingDashboard from './recording-dashboard';
import Tab from './tab';
import TabController from './tab-controller';
import TwitterDashboard from './twitter-dashboard';
import ClipDashboard from './clip-dashboard';

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
  const [ bracketState, updateBracketState ] = useServerState<BracketState>(
    bracketEndpoint('', 'ws:'),
    nullBracketState,
  );
  const [ mediaDashboardState, updateMediaDashboardState ] = useServerState<MediaState>(
    mediaDashboardEndpoint('', 'ws:'),
    nullMediaState,
  );

  return (
    <Fragment>
      <TabController>
        <Tab id="scoreboard">
          <PlayerDashboard
            state={infoState}
            updateState={updateInfoState}
            bracketState={bracketState}
          />
        </Tab>
        <Tab id="commentary">
          <CommentaryDashboard state={infoState} updateState={updateInfoState}/>
        </Tab>
        <Tab id="recording">
          <RecordingDashboard state={recordingState} updateState={updateRecordingState}/>
        </Tab>
        <Tab id="bracket">
          <BracketDashboard state={bracketState} updateState={updateBracketState}/>
        </Tab>
        <Tab id="twitter">
          <TwitterDashboard
            twitterState={twitterState}
            mediaDashboardState={mediaDashboardState}
            thread={twitterThread}
            onThreadToggle={toggleTwitterThread}
          />
        </Tab>
        <Tab id="clips">
          <ClipDashboard state={mediaDashboardState} updateState={updateMediaDashboardState}/>
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
    let action = form.action;
    let method = form.method;
    if (document.activeElement) {
      const triggerAttributes = document.activeElement.attributes;
      const actionAttr = triggerAttributes.getNamedItem('formaction');
      const methodAttr = triggerAttributes.getNamedItem('formmethod');
      action = (actionAttr && actionAttr.value) || action;
      method = (methodAttr && methodAttr.value) || method;
    }
    if (form.classList.contains('js-manual-form')) {
      return;
    }
    const body = massagedFormData(new FormData(form));
    fetch(action, { method, body })
      .catch(console.error);

    event.preventDefault();
  });
}
