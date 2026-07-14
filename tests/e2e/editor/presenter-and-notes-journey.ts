import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { presenterNotesEditorMenu } from './presenter-notes-editor-menu';
import { presenterNotesEditorSetup } from './presenter-notes-editor-setup';
import { presenterNotesTools } from './presenter-notes-tools';
import { presenterNotesWindow } from './presenter-notes-window';

export async function runPresenterAndNotesJourney(page: Page, baseURL: string): Promise<void> {
  const editor = new EditorAppPage(page, baseURL);
  await editor.gotoNewProject();

  await presenterNotesEditorSetup.addAndPersistSpeakerNotes(editor, page);
  await presenterNotesEditorSetup.addPresenterCloseSlide(page);
  await presenterNotesEditorMenu.verifyPresentationMenuAndEditorShortcuts(editor, page);

  const presenterPage = await presenterNotesWindow.open(page);
  await presenterNotesWindow.dismissIntro(presenterPage);

  await presenterNotesTools.verify(presenterPage);
}
