import type { Page } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

async function expectToolbarItemsDoNotOverlap(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const title = document.querySelector('.project-title')?.getBoundingClientRect();
          const play = document.querySelector('.project-play-shell')?.getBoundingClientRect();
          const localStatus = document.querySelector('.local-only-badge');
          const localStatusBox = localStatus?.getBoundingClientRect();
          const localStatusVisible = localStatus
            ? getComputedStyle(localStatus).display !== 'none'
            : false;
          const editingActions = document
            .querySelector('.toolbar-icon-group')
            ?.getBoundingClientRect();
          if (!title || !play || !editingActions) return false;

          return (
            title.right <= play.left &&
            (!localStatusVisible ||
              (localStatusBox !== undefined &&
                play.right <= localStatusBox.left &&
                localStatusBox.right <= editingActions.left)) &&
            play.right <= editingActions.left &&
            document.documentElement.scrollWidth <= document.documentElement.clientWidth
          );
        }),
      { timeout: 5_000 },
    )
    .toBe(true);
}

test.describe('editor top toolbar responsive layout', () => {
  test('truncates the project title before it collides with toolbar actions', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await page.setViewportSize({ width: 1365, height: 768 });
    await editor.gotoNewProject();
    await editor.renameProject('web-ai-beyond-chat-collaboration-control-room');

    await page.setViewportSize({ width: 1440, height: 768 });

    await expectToolbarItemsDoNotOverlap(page);
    await expect(page.locator('.local-only-badge')).toBeHidden();

    await page.setViewportSize({ width: 1365, height: 768 });

    await expectToolbarItemsDoNotOverlap(page);
    await expect(page.locator('.local-only-badge')).toBeHidden();

    await page.setViewportSize({ width: 1120, height: 768 });

    await expectToolbarItemsDoNotOverlap(page);
    await expect(page.locator('.language-chip')).toBeHidden();
    await expect(page.locator('.github-toolbar-link')).toBeHidden();
    await expect(page.locator('.profile-avatar')).toBeHidden();
  });
});
