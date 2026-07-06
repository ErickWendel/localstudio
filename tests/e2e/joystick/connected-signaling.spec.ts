import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('joystick connected peer journey', () => {
  test('pairs with the real presenter PeerJS session and controls the presenter view', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Close');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();

    const presenterPopupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await page.getByRole('menuitem', { name: /Presenter view/i }).click();
    const presenterPage = await presenterPopupPromise;
    await expect(presenterPage.getByRole('main', { name: 'Presenter view' })).toBeVisible();
    await page.getByRole('button', { name: 'Close audience fullscreen prompt' }).click();

    const remotePanel = page.getByRole('region', { name: 'Remote control this presentation' });
    await expect(remotePanel).toBeVisible({ timeout: 45_000 });
    const remoteUrl = await remotePanel.evaluate((element) => element.getAttribute('data-remote-url'));
    expect(remoteUrl).toContain('/joystick/?peer=');

    const joystickPage = await context.newPage();
    await joystickPage.goto(remoteUrl!);
    await expect(joystickPage.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
    await expect(joystickPage.getByLabel('Connected (1)')).toBeVisible({ timeout: 45_000 });
    await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 2');

    await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
    await joystickPage
      .getByRole('dialog', { name: 'Slide navigation' })
      .getByRole('button', { name: 'Go to slide 2: Close' })
      .click();

    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 2');
  });
});
