import type {
  PresenterCommandMessage,
  PresenterWindowCommand,
} from '../../../apps/editor/src/services/presenter/presenterSessionTypes';
import type { PresenterRoutePayload } from './presenter-route-payload';

export function installPresenterRouteInitScript(payload: PresenterRoutePayload) {
  const sessionId = 'e2e-presenter';
  let currentPayload = payload;
  const commands: string[] = [];

  function sendState() {
    window.postMessage(
      {
        payload: currentPayload,
        sessionId,
        source: 'localstudio-presenter-main',
        type: 'state',
      },
      window.location.origin,
    );
  }

  function updateActivePage(pageId: string) {
    if (!currentPayload.project.pages.some((page) => page.id === pageId)) return;
    currentPayload = { ...currentPayload, activePageId: pageId };
    window.setTimeout(sendState, 0);
  }

  function moveActivePage(direction: -1 | 1) {
    const index = currentPayload.project.pages.findIndex(
      (page) => page.id === currentPayload.activePageId,
    );
    const nextPage = currentPayload.project.pages[index + direction];
    if (nextPage) updateActivePage(nextPage.id);
  }

  function recordCommand(command: PresenterWindowCommand) {
    if (command.command === 'go-to-page') {
      commands.push(`${command.command}:${command.pageId}`);
      updateActivePage(command.pageId);
      return;
    }
    if (command.command === 'update-notes') {
      commands.push(`${command.command}:${command.pageId}`);
      currentPayload = {
        ...currentPayload,
        project: {
          ...currentPayload.project,
          pages: currentPayload.project.pages.map((projectPage) =>
            projectPage.id === command.pageId
              ? { ...projectPage, speakerNotes: command.notes }
              : projectPage,
          ),
        },
      };
      window.setTimeout(sendState, 0);
      return;
    }
    commands.push(command.command);
    if (command.command === 'next') moveActivePage(1);
    if (command.command === 'previous') moveActivePage(-1);
    if (command.command === 'request-state') window.setTimeout(sendState, 0);
  }

  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: {
      postMessage: (message: PresenterCommandMessage) => {
        if (message.source !== 'localstudio-presenter-window') return;
        recordCommand(message);
      },
    },
  });

  window.__LOCALSTUDIO_E2E_PRESENTER__ = {
    activePageId: () => currentPayload.activePageId,
    commands,
    notesFor: (pageId: string) =>
      currentPayload.project.pages.find((projectPage) => projectPage.id === pageId)?.speakerNotes,
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
