import { h, FunctionalComponent, VNode, JSX } from 'preact';
import { StateUpdater } from 'preact/hooks';

import { inputHandler } from '@util/dom';
import { truncateTimestamp, offsetTimestamp, validateTimestamp } from '@util/timestamp';

export const TimestampInput: FunctionalComponent<{
  name: string;
  value: string | null;
  updater: StateUpdater<string> | StateUpdater<string | null>,
}> = ({ name, value, updater }): VNode => {
  const backwardMedium = adjustTimestamp(updater, -3);
  const backwardSmall = adjustTimestamp(updater, -1);
  const forwardSmall = adjustTimestamp(updater, 1);
  const forwardMedium = adjustTimestamp(updater, 3);

  const keyHandler: JSX.KeyboardEventHandler = (e): void => {
    switch (e.key) {
      case 'ArrowUp':
        forwardSmall();
        break;
      case 'ArrowDown':
        backwardSmall();
        break;
    }
  };

  return (
    <fieldset class="timestamp__container">
      <div>
        <input
          type="text"
          name={name}
          value={value || ''}
          onInput={inputHandler(updater)}
          onKeyDown={keyHandler}
          pattern="\d\d:\d\d:\d\d(\.\d\d\d)?"
          placeholder="00:00:00:000"
          size={12}
          title="Timestamp in the form HH:mm:ss.SSS"
          class="timestamp__input"
        />
        <div className="timestamp__controls">
          <button type="button" onClick={backwardMedium}>-3</button>
          <button type="button" onClick={backwardSmall}>-1</button>
          <button type="button" onClick={forwardSmall}>+1</button>
          <button type="button" onClick={forwardMedium}>+3</button>
        </div>
      </div>
    </fieldset>
  );
};

function adjustTimestamp(
  updater: StateUpdater<string> | StateUpdater<string | null>,
  offsetSeconds: number,
): () => void {
  return () => {
    updater((prev: string | null) => {
      if (prev == null || !validateTimestamp(prev)) {
        return prev || '';
      }
      let ts = truncateTimestamp(prev);
      ts = offsetTimestamp(ts, offsetSeconds);
      return ts;
    });
  };
}
