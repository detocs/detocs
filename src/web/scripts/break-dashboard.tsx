import { h, FunctionalComponent, VNode } from 'preact';
import { StateUpdater } from 'preact/hooks';

import InfoState from '@server/info/state';

import { useBreakMessages } from './hooks/info';

import { infoEndpoint } from './api';
import { inputHandler } from '@util/dom';

interface Props {
  state: InfoState;
  updateState: StateUpdater<InfoState>;
}

const BreakDashboard: FunctionalComponent<Props> = ({ state, updateState }): VNode => {
  let [ messages, updateMessages ] = useBreakMessages(state, updateState);
  messages = messages.length ? messages : [''];
  const appendMsg = (): void => updateMessages(messages.concat(['']));
  const removeLastMsg = (): void => updateMessages(m => m.slice(0, -1));
  return(
    <form
      action={infoEndpoint('/break').href}
      method="post"
      autocomplete="off"
    >
      <fieldset name="messages">
        <legend>Messages</legend>
        {messages.map((m, i) =>
          <div class="input-row">
            <input
              type="text"
              name="messages[]"
              placeholder={`Message ${i + 1}`}
              value={m}
              onInput={inputHandler(str => updateMessages(mm => {
                const ret = mm.slice();
                ret[i] = str;
                return ret;
              }))}
            />
          </div>
        )}
        <div class="action-row">
          <button
            type="button"
            onClick={appendMsg}
            disabled={messages.length >= 4}
          >
            Add
          </button>
          <button
            type="button"
            class="warning"
            onClick={removeLastMsg}
            disabled={messages.length <= 1}
          >
            Remove
          </button>
        </div>
      </fieldset>
      <div class="action-row">
        <button type="submit">Update</button>
      </div>
    </form>
  );
};
export default BreakDashboard;
