import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import InfoState from '../../server/info/state';

import { useBreakMessages } from './hooks/info';

import { infoEndpoint } from './api';

interface Props {
  state: InfoState;
  updateState: StateUpdater<InfoState>;
}

const BreakDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  const [ messages ] = useBreakMessages(state, updateState);
  return(
    <form
      action={infoEndpoint('/break').href}
      method="post"
      autocomplete="off"
    >
      <fieldset name="messages">
        <legend>Messages</legend>
        <div class="input-row">
          <input
            type="text"
            name="messages[]"
            placeholder="Message"
            value={messages[0]}
          />
        </div>
      </fieldset>
      <div class="input-row">
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default BreakDashboard;
