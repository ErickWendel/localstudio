import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('joystick connected peer journey', () => {
  test('pairs with the real presenter PeerJS session and controls the presenter view', async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const diagnostics: string[] = [];
    const captureDiagnostics = (source: string) => (message: { text: () => string }) => {
      const text = message.text();
      if (text.includes('LocalStudio presenter remote') || text.includes('PeerJS')) {
        diagnostics.push(`${source}: ${text}`);
        if (/error|failed|timed out|lost connection/i.test(text)) {
          console.log(`${source}: ${text}`);
        }
      }
    };
    page.on('console', captureDiagnostics('editor console'));
    page.on('pageerror', (error) => diagnostics.push(`editor pageerror: ${error.message}`));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            await Promise.resolve();
            window.localStorage.setItem('localstudio.e2e.copiedRemoteLink', text);
          },
        },
      });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Close');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('3 / 3')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 3' }).click();
    await page.getByLabel('Page 3 title').fill('Appendix');
    await page.getByLabel('Page 3 title').press('Enter');
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await page
      .getByRole('textbox', { name: 'Speaker notes' })
      .fill('Use this space to capture presenter notes');
    await page.getByRole('button', { name: 'Close notes panel' }).click();

    const presenterPopupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await page.getByRole('menuitem', { name: /Presenter view/i }).click();
    const presenterPage = await presenterPopupPromise;
    await expect(presenterPage.getByRole('main', { name: 'Presenter view' })).toBeVisible();

    const remotePanel = page.getByRole('region', { name: 'Remote control this presentation' });
    await expect(remotePanel).toBeVisible({ timeout: 45_000 });
    await expect(remotePanel.getByRole('img', { name: 'Remote control QR code' })).toBeVisible();
    const remoteUrl = await remotePanel.evaluate((element) => element.getAttribute('data-remote-url'));
    expect(remoteUrl).toContain('/joystick/?peer=');
    await remotePanel.getByRole('button', { name: 'Copy remote link' }).click();
    await expect(remotePanel.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('localstudio.e2e.copiedRemoteLink')))
      .toBe(remoteUrl);
    const localRemoteUrl = new URL(remoteUrl!);
    const localBaseUrl = new URL(getServer().baseURL);
    localRemoteUrl.protocol = localBaseUrl.protocol;
    localRemoteUrl.host = localBaseUrl.host;
    await page.getByRole('button', { name: 'Enter full screen mode' }).click();

    const introDismissButton = presenterPage.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible().catch(() => false)) await introDismissButton.click();

    const joystickPage = await context.newPage();
    joystickPage.on('console', captureDiagnostics('joystick console'));
    joystickPage.on('pageerror', (error) => diagnostics.push(`joystick pageerror: ${error.message}`));
    await joystickPage.goto(localRemoteUrl.toString());
    await expect(joystickPage.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
    await expect(joystickPage.getByLabel('Connected (1)')).toBeVisible({ timeout: 45_000 });
    await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');
    await expect(joystickPage.getByLabel('Presenter notes content')).toContainText(
      'Use this space to capture presenter notes',
    );
    await joystickPage.getByRole('button', { name: 'Increase notes size' }).click();
    await joystickPage.getByRole('button', { name: 'Decrease notes size' }).click();
    await joystickPage.getByRole('button', { name: 'Pause timer' }).click();
    await expect(joystickPage.getByRole('button', { name: 'Resume timer' })).toBeVisible({
      timeout: 10_000,
    });
    await joystickPage.getByRole('button', { name: 'Reset timer' }).click();
    await expect(joystickPage.getByLabel('Presentation timer')).toContainText('00:00');

    await expect(joystickPage.getByRole('button', { name: 'Presenter stream preview' })).toBeVisible();
    const streamPreview = joystickPage.getByRole('button', { name: 'Presenter stream preview' });
    await joystickPage.getByRole('button', { name: 'Go to slide 2: Close' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
    await joystickPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');
    const notesResizeHandle = joystickPage.getByRole('button', { name: 'Resize presenter notes' });
    const notesHeightBefore = await joystickPage
      .getByRole('main', { name: 'Presentation remote control' })
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--joystick-stream-notes-height'));
    const resizeBox = await notesResizeHandle.boundingBox();
    expect(resizeBox).not.toBeNull();
    await joystickPage.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y + resizeBox!.height / 2);
    await joystickPage.mouse.down();
    await joystickPage.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y - 80);
    await joystickPage.mouse.up();
    await expect
      .poll(() =>
        joystickPage
          .getByRole('main', { name: 'Presentation remote control' })
          .evaluate((element) => getComputedStyle(element).getPropertyValue('--joystick-stream-notes-height')),
      )
      .not.toBe(notesHeightBefore);
    await streamPreview.dispatchEvent('pointerdown', {
      clientX: 320,
      pointerType: 'touch',
    });
    await streamPreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerType: 'touch',
    });
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
    await expect(joystickPage.getByText('Presenter notes that are created will appear here')).toBeVisible();

    await streamPreview.dispatchEvent('pointerdown', {
      clientX: 320,
      pointerType: 'touch',
    });
    await streamPreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerType: 'touch',
    });
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('3 / 3');

    await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
    const slideNavigation = joystickPage.getByRole('dialog', { name: 'Slide navigation' });
    await expect(slideNavigation.getByRole('button', { name: 'Go to slide 1: Slide 1' })).toBeVisible();
    await slideNavigation.getByRole('button', { name: 'Close slide navigation' }).click();
    await expect(slideNavigation).toBeHidden();
    await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
    await joystickPage
      .getByRole('dialog', { name: 'Slide navigation' })
      .getByRole('button', { name: 'Go to slide 2: Close' })
      .click();

    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');

    await joystickPage.reload();
    await expect(joystickPage.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
    await expect(joystickPage.getByLabel('Connected (1)')).toBeVisible({ timeout: 45_000 });
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
    await joystickPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');

    await testInfo.attach('presenter-remote-diagnostics', {
      body: diagnostics.join('\n') || 'No presenter remote diagnostics captured.',
      contentType: 'text/plain',
    });
  });
});
