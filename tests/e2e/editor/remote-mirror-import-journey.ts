import type { BrowserContext, Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { remoteMirrorImportBrowserSetup } from './remote-mirror-import-browser-setup';
import { remoteMirrorImportFlow } from './remote-mirror-import-flow';
import { remoteMirrorImportRoutes } from './remote-mirror-import-routes';

export const remoteMirrorImportJourney = {
  async run(context: BrowserContext, page: Page, baseURL: string): Promise<void> {
    await remoteMirrorImportBrowserSetup.install(page);
    await remoteMirrorImportRoutes.install(context);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await remoteMirrorImportFlow.importRemoteMirrorDeck(editor, page);
    await remoteMirrorImportFlow.verifyImportedProject(page);
  },
};
