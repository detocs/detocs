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
import { checkResponseStatus } from '@util/ajax';
import { ancestors } from '@util/dom';
import { massagedFormData } from '@util/forms';
import { getVersion, getProductName } from '@util/meta';

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
import {
  usePlayersReversed,
  useCommentatorsReversed,
  useThumbnailVideosEnabled,
  ThumbnailSettingsContext,
} from './hooks/settings';
import { logError } from './log';
import PlayerDashboard from './player-dashboard';
import RecordingDashboard from './recording-dashboard';
import SettingsDashboard from './settings-dashboard';
import Tab from './tab';
import TabController from './tab-controller';
import TwitterDashboard from './twitter-dashboard';

document.addEventListener('DOMContentLoaded', () => {
  bindSubmitHandler();
  bindInvalidHandler();
  bindErrorHandler();
  render(<App />, document.getElementById("app") as HTMLDivElement);
});

const VERSION = getVersion();
const PRODUCT_NAME = getProductName();

const App: FunctionalComponent = (): VNode => {
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
  const [ bracketState, updateBracketState ] = useServerState<BracketState>(
    bracketEndpoint('', 'ws:'),
    nullBracketState,
  );
  const [ clipState, updateClipState ] = useServerState<ClipState>(
    clipEndpoint('', 'ws:'),
    nullClipState,
  );
  const [ playersReversed, togglePlayersReversed ] = usePlayersReversed();
  const [ commentatorsReversed, toggleCommentatorsReversed ] = useCommentatorsReversed();
  const [ thumbnailVideosEnabled, toggleThumbnailVideosEnabled ] = useThumbnailVideosEnabled();
  const ToastContainer = ReactToastContainer as FunctionalComponent;
  return (
    <ThumbnailSettingsContext.Provider value={thumbnailVideosEnabled}>
      <TabController>
        <Tab id="scoreboard">
          <PlayerDashboard
            state={infoState}
            updateState={updateInfoState}
            bracketState={bracketState}
            reversed={playersReversed}
          />
        </Tab>
        <Tab id="commentary">
          <CommentaryDashboard
            state={infoState}
            updateState={updateInfoState}
            reversed={commentatorsReversed}
          />
        </Tab>
        <Tab id="recording">
          <RecordingDashboard state={recordingState} updateState={updateRecordingState}/>
        </Tab>
        <Tab id="twitter">
          <TwitterDashboard
            twitterState={twitterState}
            clipState={clipState}
          />
        </Tab>
        <Tab id="clips">
          <ClipDashboard state={clipState} updateState={updateClipState}/>
        </Tab>
        <Tab id="bracket">
          <BracketDashboard state={bracketState} updateState={updateBracketState}/>
        </Tab>
        <Tab id="break">
          <BreakDashboard state={infoState} updateState={updateInfoState}/>
        </Tab>
        <Tab id="settings">
          <SettingsDashboard
            {...{
              playersReversed,
              togglePlayersReversed,
              commentatorsReversed,
              toggleCommentatorsReversed,
              thumbnailVideosEnabled,
              toggleThumbnailVideosEnabled,
            }}
          />
        </Tab>
      </TabController>
      <footer id="version">{PRODUCT_NAME} {VERSION}</footer>
      <ToastContainer />
    </ThumbnailSettingsContext.Provider>
  );
};

function bindSubmitHandler(): void {
  document.addEventListener('submit', (event: Event) => {
    const form = event.target as HTMLFormElement;
    if (form.classList.contains('js-manual-form')) {
      return;
    }
    const { action, method } = getFormRoute(form);
    const body = massagedFormData(new FormData(form));
    fetch(action, { method, body })
      .then(checkResponseStatus)
      .catch(logError);

    event.preventDefault();
  });
}

function getFormRoute(form: HTMLFormElement): { action: string, method: string } {
  let action = form.action;
  let method = form.method;
  if (document.activeElement) {
    const triggerAttributes = document.activeElement.attributes;
    const actionAttr = triggerAttributes.getNamedItem('formaction');
    const methodAttr = triggerAttributes.getNamedItem('formmethod');
    action = (actionAttr && actionAttr.value) || action;
    method = (methodAttr && methodAttr.value) || method;
  }
  return { action, method };
}

function bindInvalidHandler(): void {
  document.addEventListener('invalid', (event: Event) => {
    event.target && expandDetailsAncestors(event.target as Element);
  }, { capture: true });
}

function expandDetailsAncestors(elem: Element): void {
  const details = ancestors(elem, 'details:not([open])') as HTMLDetailsElement[];
  details.forEach(details => details.open = true);
}

function bindErrorHandler(): void {
  window.addEventListener('error', evt => logError(evt, false));
}
