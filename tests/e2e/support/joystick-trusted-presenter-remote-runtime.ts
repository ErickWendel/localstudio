import type { Page } from '@playwright/test';
import type { PresenterRemoteCommand } from '@localstudio/presenter-remote/protocol';

import type { JoystickTrustedPresenterInstallConfig } from './joystick-trusted-presenter-types';

export const joystickTrustedPresenterRemoteRuntime = {
  async install(page: Page, config: JoystickTrustedPresenterInstallConfig): Promise<void> {
    await page.addInitScript(({ initialState, sessions }) => {
      let state = initialState;
      const commands: string[] = [];

      function setActivePage(pageId: string) {
        const targetIndex = state.pages?.findIndex((page) => page.id === pageId) ?? -1;
        if (targetIndex < 0) return;
        const targetPage = state.pages?.[targetIndex];
        const nextPage = state.pages?.[targetIndex + 1];
        const upcomingSlidePreviews =
          state.pages?.slice(targetIndex + 1, targetIndex + 4).map((page) => ({
            pageId: page.id,
            pageName: page.name,
            preview:
              page.preview ??
              state.upcomingSlidePreviews?.find((item) => item.pageId === page.id)?.preview,
          })) ?? [];
        state = {
          ...state,
          activePageId: pageId,
          activePageIndex: targetIndex,
          activePageName: targetPage?.name,
          builds: targetIndex === 0 ? { current: 1, remaining: 1, total: 2 } : undefined,
          buildsRemaining: targetIndex === 0 ? 1 : 0,
          nextPageName: nextPage?.name,
          nextSlidePreview: upcomingSlidePreviews[0]?.preview,
          notes: targetIndex === 3 ? '' : state.notes,
          slidePreview: targetPage?.preview ?? state.slidePreview,
          upcomingSlidePreviews,
        };
      }

      window.__LOCALSTUDIO_E2E_JOYSTICK__ = {
        commands,
        setPresenterMode: (presenterMode) => {
          state = { ...state, presenterMode };
        },
      };

      window.__LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__ = {
        connectController: (code: string) => {
          const session = sessions.find((item) => item.code === code);
          return session ? { ...session, connectedControllerCount: 2 } : undefined;
        },
        getPublishedState: () => state,
        listSessions: () => sessions,
        lookupSession: (code: string) => sessions.find((session) => session.code === code),
        publishCommand: (_code: string, command: PresenterRemoteCommand) => {
          commands.push(
            command.command === 'go-to-page'
              ? `${command.command}:${command.pageId}`
              : command.command,
          );
          if (command.command === 'go-to-page') setActivePage(command.pageId);
          if (command.command === 'previous') {
            const previousPage = state.pages?.[state.activePageIndex - 1];
            if (previousPage) setActivePage(previousPage.id);
          }
          if (command.command === 'next') {
            const nextPage = state.pages?.[state.activePageIndex + 1];
            if (nextPage) setActivePage(nextPage.id);
          }
          if (command.command === 'pause-timer') {
            state = { ...state, timer: { ...state.timer, paused: true } };
          }
          if (command.command === 'resume-timer') {
            state = {
              ...state,
              timer: { ...state.timer, paused: false, updatedAtEpochMs: Date.now() },
            };
          }
          if (command.command === 'reset-timer') {
            state = {
              ...state,
              timer: { elapsedMs: 0, paused: true, updatedAtEpochMs: Date.now() },
            };
          }
          return true;
        },
      };
    }, config);
  },
};
