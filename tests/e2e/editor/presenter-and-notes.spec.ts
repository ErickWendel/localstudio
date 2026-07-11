import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor presenter notes journey', () => {
  test('writes notes and verifies presenter controls without requiring an external display', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await expect(page.getByRole('region', { name: 'Speaker notes editor' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Speaker notes' }).fill('Remember to pause after the opening slide.');
    await page.getByRole('button', { name: 'Close notes panel' }).click();
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await expect(page.getByRole('textbox', { name: 'Speaker notes' })).toHaveValue(
      'Remember to pause after the opening slide.',
    );
    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });
    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Presenter Close');
    await page.getByLabel('Page 2 title').press('Enter');
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();

    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await expect(page.getByRole('menu', { name: 'Presentation play menu' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Present in fullscreen/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Presenter view/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Play from beginning/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await editor.openMenu('Help');
    await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toContainText(
      'Open the slide navigator',
    );

    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
    const presenterPopupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await page.getByRole('menuitem', { name: /Presenter view/i }).click();
    const presenterPage = await presenterPopupPromise;
    await expect(presenterPage.getByRole('main', { name: 'Presenter view' })).toBeVisible();
    expect(await presenterPage.evaluate(() => Boolean(window.opener))).toBe(true);
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Enter full screen mode' }).click();

    const introDismissButton = presenterPage.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible().catch(() => false)) {
      await presenterPage.getByLabel("Don't show this message again").check();
      await introDismissButton.click();
    }

    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await expect(presenterPage.getByLabel('Speaker notes')).toHaveValue(
      'Remember to pause after the opening slide.',
    );
    await presenterPage.getByLabel('Speaker notes').fill('Presenter edited notes');
    await expect(presenterPage.getByLabel('Speaker notes')).toHaveValue('Presenter edited notes');
    await presenterPage.getByRole('button', { name: 'Pause timer' }).click();
    await expect(presenterPage.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await presenterPage.getByRole('button', { name: 'Reset timer' }).click();
    await presenterPage.getByRole('button', { name: 'Increase notes size' }).click();
    await presenterPage.getByRole('button', { name: 'Decrease notes size' }).click();
    await presenterPage.getByRole('button', { name: 'Show remote control QR code' }).click();
    await expect(
      presenterPage.getByRole('region', { name: 'Remote control this presentation' }),
    ).toBeVisible();
    await presenterPage.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 12, y: 12 } });
    await expect(
      presenterPage.getByRole('region', { name: 'Remote control this presentation' }),
    ).toBeHidden();

    const notesResizer = presenterPage.getByRole('separator', { name: 'Resize presenter notes' });
    await notesResizer.focus();
    await presenterPage.keyboard.press('ArrowLeft');
    await presenterPage.keyboard.press('ArrowRight');
    await presenterPage.keyboard.press('Home');
    await presenterPage.keyboard.press('End');

    await presenterPage.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await expect(presenterPage.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeVisible();
    await presenterPage.getByRole('button', { name: 'Close keyboard shortcuts' }).click();

    await presenterPage.getByRole('button', { name: 'Next slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await presenterPage
      .getByRole('navigation', { name: 'Slide previews' })
      .getByRole('button', {
        name: 'Presenter Close',
      })
      .click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await presenterPage.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await presenterPage.getByRole('button', { name: 'Go to first slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await presenterPage.getByRole('button', { name: 'Go to last slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
    await presenterPage.keyboard.press('Shift+Digit3');
    const slideNavigator = presenterPage.getByRole('dialog', { name: 'Slide navigator' });
    await expect(slideNavigator).toBeVisible();
    await presenterPage.keyboard.press('Minus');
    await expect(slideNavigator.getByRole('option', { name: /Slide 1.*Slide 1/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await presenterPage.keyboard.press('Equal');
    await expect(slideNavigator.getByRole('option', { name: /Slide 2.*Presenter Close/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await presenterPage.keyboard.press('Escape');
    await expect(slideNavigator).toBeHidden();
    await presenterPage.keyboard.press('Shift+Digit3');
    await expect(slideNavigator).toBeVisible();
    const closeSlideOption = slideNavigator.getByRole('option', { name: /Slide 2.*Presenter Close/ });
    await closeSlideOption.click();
    await expect(closeSlideOption).toHaveAttribute('aria-selected', 'true');
    await presenterPage.keyboard.press('Enter');
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
  });
});
