import { h, VNode } from 'preact';

import { GetClipResponse } from '@server/clip/server.ts';
import { checkResponseStatus } from '@util/ajax.ts';

import { clipEndpoint } from './api.ts';
import { NUM_RECENT_SCENES } from './constants.ts';
import { logError } from './log.ts';
import { Menu, MenuAction, MenuSection } from './menu.tsx';

const screenshotEndpoint = clipEndpoint('/screenshot').href;

function screenshot(sceneName?: string): Promise<string> {
  const body = JSON.stringify({sceneName});
  return fetch(screenshotEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
    .then(checkResponseStatus)
    .then(resp => resp.json() as Promise<GetClipResponse>)
    .then(resp => resp.id);
}

export function SceneScreenshotMenu({
  scenes, updateCurrentClipId, recentScenes, addRecentScene,
}: {
  scenes: string[];
  updateCurrentClipId: (id: string) => void;
  recentScenes: string[];
  addRecentScene: (scene: string) => void;
}): VNode {
  const screenshotCurrentScene = (): Promise<void> => screenshot()
    .then(updateCurrentClipId)
    .catch(logError);
  function sceneToAction(scene: string): MenuAction {
    return ({
      label: scene,
      onClick: () => screenshot(scene)
        .then(updateCurrentClipId)
        .then(() => addRecentScene(scene))
        .catch(logError),
    });
  }

  let actions: (MenuAction | MenuSection)[] = [];

  if (recentScenes.length == 0 || scenes.length <= NUM_RECENT_SCENES) {
    actions = scenes.map(sceneToAction);
  } else {
    actions = [
      {
        label: 'Recent',
        actions: recentScenes.map(sceneToAction),
      },
      ...scenes.filter(scene => !recentScenes.includes(scene)).map(sceneToAction),
    ];
  }

  if (!scenes.length) {
    return <button type="button" onClick={screenshotCurrentScene}>Screenshot</button>;
  }
  return (
    <Menu
      label="Screenshot Scene"
      defaultAction={{
        label: 'Take Screenshot',
        onClick: screenshotCurrentScene,
      }}
      actions={actions} />
  );
}
