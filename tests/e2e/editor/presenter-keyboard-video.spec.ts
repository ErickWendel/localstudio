import { EditorAppPage } from '../pages/editor-app.page';
import { getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test('presents from the editor and controls slides and video with keyboard shortcuts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: () => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      },
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: () => {
        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      },
    });
  });

  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();

  await editor.openTool('Assets');
  await page.getByLabel('Import media file').setInputFiles(getBigBuckBunnyMp4Fixture());
  await expect(page.getByText('Big_Buck_Bunny_360_10s_1MB.mp4')).toBeVisible();

  await editor.openTool('Layout');
  await page.getByRole('button', { name: 'Big_Buck_Bunny_360_10s_1MB.mp4', exact: true }).click();

  await editor.openPagesPanel();
  const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
  await pagesPanel.getByLabel('Add page').click();
  await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
  await page.getByLabel('Page 2 title').fill('Keyboard close');
  await page.getByLabel('Page 2 title').press('Enter');
  await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();

  await page.getByRole('button', { name: 'Presentation play options' }).click();
  await page.getByRole('menuitem', { name: /Present in fullscreen/i }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);

  const workspace = page.getByRole('region', { name: 'Canvas workspace' });
  await workspace.focus();
  await expect(page.getByText('1 / 2')).toBeVisible();

  const video = workspace
    .locator('video.canvas-media-element[aria-label="Big_Buck_Bunny_360_10s_1MB.mp4"]')
    .first();
  await expect(video).toBeVisible();
  await video.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const movie = element as HTMLVideoElement;
        if (Number.isFinite(movie.duration) && movie.duration > 0) {
          resolve();
          return;
        }
        movie.addEventListener('loadedmetadata', () => resolve(), { once: true });
      }),
  );
  await video.evaluate((element) => {
    const movie = element as HTMLVideoElement;
    movie.muted = true;
    movie.pause();
    movie.currentTime = Math.min(1, Number.isFinite(movie.duration) ? movie.duration / 2 : 1);
  });

  await editor.openMenu('Help');
  await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
  const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(shortcuts).toBeVisible();

  await shortcuts.getByRole('button', { name: 'Pause/Play movie' }).click();
  await shortcuts.getByRole('button', { name: 'Pause/Play movie' }).click();

  await shortcuts.getByRole('button', { name: 'Jump to end of movie' }).click();
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeGreaterThan(5);
  await shortcuts.getByRole('button', { name: 'Jump to beginning of movie' }).click();
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeLessThan(0.2);
  await page.keyboard.down('l');
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).playbackRate))
    .toBe(2);
  await page.keyboard.up('l');
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).playbackRate))
    .toBe(1);
  await video.evaluate((element) => {
    const movie = element as HTMLVideoElement;
    movie.pause();
    movie.currentTime = 1;
  });
  await shortcuts.getByRole('button', { name: 'Hold to rewind movie' }).click();
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeLessThan(1);

  await shortcuts.getByRole('button', { name: 'Open the slide navigator' }).click();
  const slideNavigator = page.getByRole('dialog', { name: 'Slide navigator' });
  await expect(slideNavigator).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Go to the next slide in the slide navigator' }).click();
  await expect(slideNavigator.getByRole('option', { name: /Slide 2.*Keyboard close/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await shortcuts.getByRole('button', { name: 'Go to the current slide in the slide navigator' }).click();
  await expect(page.getByText('2 / 2')).toBeVisible();

  await shortcuts.getByRole('button', { name: 'Go to first slide' }).click();
  await expect(page.getByText('1 / 2')).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Go to last slide' }).click();
  await expect(page.getByText('2 / 2')).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Go back to previous slide' }).click();
  await expect(page.getByText('1 / 2')).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Advance to next build' }).first().click();
  await expect(page.getByText('2 / 2')).toBeVisible();

  await shortcuts.getByRole('button', { name: 'Pause presentation and show black screen' }).click();
  await expect(page.getByLabel('Black screen')).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Pause presentation; press any key to resume' }).click();
  await expect(page.getByLabel('Black screen')).toBeHidden();
  await shortcuts.getByRole('button', { name: 'Pause presentation and show white screen' }).click();
  await expect(page.getByLabel('White screen')).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Pause presentation; press any key to resume' }).click();
  await expect(page.getByLabel('White screen')).toBeHidden();
  await shortcuts.getByRole('button', { name: 'Display the current slide number' }).click();
  await expect(page.getByText('Slide 2 of 2')).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Quit presentation mode' }).click();
  await expect(shortcuts).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});
