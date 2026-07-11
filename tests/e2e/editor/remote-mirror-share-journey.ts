import type { BrowserContext, Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { remoteMirrorShareEditorSetup } from './remote-mirror-share-editor-setup';
import { remoteMirrorShareEmbedView } from './remote-mirror-share-embed-view';
import { remoteMirrorShareLinks } from './remote-mirror-share-links';
import { remoteMirrorSharePublicView } from './remote-mirror-share-public-view';
import { remoteMirrorShareRoutes } from './remote-mirror-share-routes';
import { remoteMirrorShareSettings } from './remote-mirror-share-settings';
import { remoteMirrorShareSetup } from './remote-mirror-share-setup';

export const remoteMirrorShareJourney = {
  async run(context: BrowserContext, page: Page, baseURL: string): Promise<void> {
    await remoteMirrorShareSetup.install(context, page, baseURL);
    await remoteMirrorShareRoutes.install(context);

    const editor = new EditorAppPage(page, baseURL);
    await remoteMirrorShareEditorSetup.createMirroredProject(editor, page);
    await remoteMirrorShareSettings.enableMirroring(page);
    const links = await remoteMirrorShareLinks.create(page);
    await remoteMirrorSharePublicView.verify(context, links.publicUrl);
    await remoteMirrorShareEmbedView.verify(context, links.embedSrc);
  },
};
