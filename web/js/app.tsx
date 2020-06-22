import { h, render, FunctionalComponent, VNode, Fragment } from 'preact';
import { ToastContainer as ReactToastContainer } from 'react-toastify';

import BracketState, { nullState as nullBracketState } from '@server/bracket/state';
import {
  State as ClipState,
  nullState as nullClipState
} from '@server/clip/state';
import InfoState, { nullState as nullInfoState } from '@server/info/state';
import RecordingState, { nullState as nullRecordingState } from '@server/recording/state';
import TwitterState, { nullState as nullTwitterState } from '@server/twitter/client-state';
import { massagedFormData } from '@util/forms';
import { getVersion } from '@util/meta';

import {
  infoEndpoint,
  twitterEndpoint,
  recordingEndpoint,
  bracketEndpoint,
  clipEndpoint
} from './api';
import BracketDashboard from './bracket-dashboard';
import BreakDashboard from './break-dashboard';
import ClipDashboard from './clip-dashboard';
import CommentaryDashboard from './commentary-dashboard';
import { useServerState } from './hooks/server-state';
import { useToggle } from './hooks/toggle';
import { logError } from './log';
import PlayerDashboard from './player-dashboard';
import RecordingDashboard from './recording-dashboard';
import Tab from './tab';
import TabController from './tab-controller';
import TwitterDashboard from './twitter-dashboard';

document.addEventListener('DOMContentLoaded', () => {
  bindSubmitHandler();
  bindErrorHandler();
  render(<App />, document.getElementById("app") as HTMLDivElement);
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
  const [ clipState, updateClipState ] = useServerState<ClipState>(
    clipEndpoint('', 'ws:'),
    nullClipState,
  );
  const ToastContainer = ReactToastContainer as FunctionalComponent;
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
            clipState={clipState}
            thread={twitterThread}
            onThreadToggle={toggleTwitterThread}
          />
        </Tab>
        <Tab id="clips">
          <ClipDashboard state={clipState} updateState={updateClipState}/>
        </Tab>
        <Tab id="break">
          <BreakDashboard state={infoState} updateState={updateInfoState}/>
        </Tab>
      </TabController>
      <footer id="version">DETOCS {version}</footer>
      <ToastContainer />
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
      .catch(logError);

    event.preventDefault();
  });
}

function bindErrorHandler(): void {
  window.addEventListener('error', logError);
}
