import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { presenterKeyboardPauseShortcuts } from './presenter-keyboard-pause-shortcuts';
import { presenterKeyboardSlideShortcuts } from './presenter-keyboard-slide-shortcuts';
import { presenterKeyboardVideoSetup } from './presenter-keyboard-video-setup';
import { presenterKeyboardVideoShortcuts } from './presenter-keyboard-video-shortcuts';

export async function runPresenterKeyboardVideoJourney(page: Page, baseURL: string): Promise<void> {
  await presenterKeyboardVideoSetup.installFullscreenMock(page);

  const editor = new EditorAppPage(page, baseURL);
  await editor.gotoNewProject();
  await presenterKeyboardVideoSetup.addVideoAndSecondSlide(editor, page);
  await presenterKeyboardVideoSetup.enterFullscreenPresentation(editor, page);

  const workspace = page.getByRole('region', { name: 'Canvas workspace' });
  await workspace.focus();
  await expect(page.getByText('1 / 2')).toBeVisible();

  const video = await presenterKeyboardVideoSetup.prepareVideo(workspace);
  const shortcuts = await presenterKeyboardVideoSetup.openKeyboardShortcuts(editor, page);

  await presenterKeyboardVideoShortcuts.verify(page, shortcuts, video);
  await presenterKeyboardSlideShortcuts.verify(page, shortcuts);
  await presenterKeyboardPauseShortcuts.verify(page, shortcuts);
}
