import { type BrowserContext, type Page } from '@playwright/test';

import { installFakeOpfs } from '../support/fake-opfs';

export const copiedShareUrlStorageKey = 'localstudio.e2e.copiedShareUrl';

export const remoteMirrorShareSetup = {
  async install(context: BrowserContext, page: Page, baseURL: string): Promise<void> {
    await installFakeOpfs(page);
    await page.addInitScript((storageKey) => {
      const execCommand = document.execCommand.bind(document);
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value(commandId: string, showUi?: boolean, value?: string) {
          if (commandId === 'copy') {
            const activeElement = document.activeElement;
            if (
              activeElement instanceof HTMLInputElement ||
              activeElement instanceof HTMLTextAreaElement
            ) {
              window.localStorage.setItem(storageKey, activeElement.value);
            }
          }
          return execCommand(commandId, showUi, value);
        },
      });
    }, copiedShareUrlStorageKey);
    await context.grantPermissions(['clipboard-write'], { origin: baseURL });
  },
};
