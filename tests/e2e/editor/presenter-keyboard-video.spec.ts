import { runPresenterKeyboardVideoJourney } from './presenter-keyboard-video-journey';
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { presenterKeyboardVideoSetup } from './presenter-keyboard-video-setup';
import { presenterNotesWindow } from './presenter-notes-window';
import { seekPresenterVideoFrame } from './presenter-video-frame-seek-browser';

const getServer = withIsolatedDevServer(test);

test('presents from the editor and controls slides and video with keyboard shortcuts', async ({
  page,
}) => {
  await runPresenterKeyboardVideoJourney(page, getServer().baseURL);
});

test('renders changing GIF frames in the presenter viewer', async ({ page }, testInfo) => {
  await presenterKeyboardVideoSetup.installFullscreenMock(page);
  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();
  await presenterKeyboardVideoSetup.addGif(editor, page, testInfo);

  const presenterPage = await presenterNotesWindow.open(page);
  const currentSlide = presenterPage.getByRole('region', { name: 'Current slide' });
  const gif = currentSlide.locator(
    'img.canvas-media-element[aria-label="localstudio-e2e-pixel.gif"]',
  );
  await expect(gif).toBeVisible();
  await expect(gif).toHaveAttribute('src', /^blob:/);
  const firstFrame = await currentSlide.screenshot();
  await expect.poll(async () => !(await currentSlide.screenshot()).equals(firstFrame)).toBe(true);
});

test('renders changing video frames in the presenter viewer', async ({ page }) => {
  await presenterKeyboardVideoSetup.installFullscreenMock(page);
  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();
  await presenterKeyboardVideoSetup.addVideoAndSecondSlide(editor, page);

  const presenterPage = await presenterNotesWindow.open(page);
  const currentSlide = presenterPage.getByRole('region', { name: 'Current slide' });
  const video = currentSlide.locator(
    'video.canvas-media-element[aria-label="Big_Buck_Bunny_360_10s_1MB.mp4"]',
  );
  await expect(video).toBeVisible();

  async function captureFrame(time: number) {
    await video.evaluate(seekPresenterVideoFrame, time);
    return video.screenshot();
  }

  const firstFrame = await captureFrame(1);
  const secondFrame = await captureFrame(5);
  expect(firstFrame.equals(secondFrame)).toBe(false);
});
