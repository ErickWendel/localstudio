import type { PresenterCommandMessage } from '../../../apps/editor/src/services/presenter/presenterSessionTypes';
import type { PresenterRoutePayload } from './presenter-route-payload';
import { createPresenterRouteSessionState } from './presenter-route-session-state';

function installPresenterRouteInitScript(payload: PresenterRoutePayload) {
  const sessionId = 'e2e-presenter';
  const sendState = (statePayload: PresenterRoutePayload) => {
    window.postMessage(
      {
        payload: statePayload,
        sessionId,
        source: 'localstudio-presenter-main',
        type: 'state',
      },
      window.location.origin,
    );
  };
  const sessionState = createPresenterRouteSessionState(payload, sendState);

  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: {
      postMessage: (message: PresenterCommandMessage) => {
        if (message.source !== 'localstudio-presenter-window') return;
        sessionState.handleCommand(message);
      },
    },
  });

  window.__LOCALSTUDIO_E2E_PRESENTER__ = {
    activePageId: sessionState.activePageId,
    commands: sessionState.commands,
    notesFor: sessionState.notesFor,
    sendCommand: (command) => {
      window.postMessage(
        {
          command,
          sessionId,
          source: 'localstudio-presenter-main',
          type: 'command',
        },
        window.location.origin,
      );
    },
  };
}

export const presenterRouteInitScript = {
  createContent: (payload: PresenterRoutePayload): string => {
    const serializedPayload = JSON.stringify(payload);
    return `
const createPresenterRouteSessionState = ${createPresenterRouteSessionState.toString()};
(${installPresenterRouteInitScript.toString()})(${serializedPayload});
`;
  },
};
