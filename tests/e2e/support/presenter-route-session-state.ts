import type { PresenterWindowCommand } from '../../../apps/editor/src/services/presenter/presenterSessionTypes';
import type { PresenterRoutePayload } from './presenter-route-payload';

export type PresenterRouteSessionState = {
  activePageId: () => string;
  commands: string[];
  handleCommand: (command: PresenterWindowCommand) => void;
  notesFor: (pageId: string) => string | undefined;
};

export function createPresenterRouteSessionState(
  payload: PresenterRoutePayload,
  sendState: (payload: PresenterRoutePayload) => void,
): PresenterRouteSessionState {
  let currentPayload = payload;
  const commands: string[] = [];

  const scheduleState = () => {
    window.setTimeout(() => sendState(currentPayload), 0);
  };

  const updateActivePage = (pageId: string) => {
    if (!currentPayload.project.pages.some((page) => page.id === pageId)) return;
    currentPayload = { ...currentPayload, activePageId: pageId };
    scheduleState();
  };

  const moveActivePage = (direction: -1 | 1) => {
    const index = currentPayload.project.pages.findIndex(
      (page) => page.id === currentPayload.activePageId,
    );
    const nextPage = currentPayload.project.pages[index + direction];
    if (nextPage) updateActivePage(nextPage.id);
  };

  return {
    activePageId: () => currentPayload.activePageId,
    commands,
    handleCommand: (command) => {
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
        scheduleState();
        return;
      }
      commands.push(command.command);
      if (command.command === 'next') moveActivePage(1);
      if (command.command === 'previous') moveActivePage(-1);
      if (command.command === 'request-state') scheduleState();
    },
    notesFor: (pageId) =>
      currentPayload.project.pages.find((projectPage) => projectPage.id === pageId)?.speakerNotes,
  };
}
