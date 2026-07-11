import { JoystickAppPage } from '../pages/joystick-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickTrustedPresenterHarness } from '../support/joystick-trusted-presenter-harness';

const getServer = withIsolatedDevServer(test);

test.describe('joystick trusted reconnect journey', () => {
  test('reconnects a trusted phone and controls a non-peer presenter session', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await joystickTrustedPresenterHarness.installTrustedPresenterRemote(page, {
      initialState: joystickTrustedPresenterHarness.createRemoteState('ready'),
      sessions: [
        joystickTrustedPresenterHarness.createSession({
          code: 'A1D1-2345',
          expiresAt: '2026-07-09T20:00:00.000Z',
          presenterDeviceId: 'trusted-presenter',
          presenterLabel: 'Old presenter display',
        }),
        joystickTrustedPresenterHarness.createSession({
          code: 'TRU5-7ED1',
          expiresAt: '2026-07-09T22:00:00.000Z',
          presenterDeviceId: 'trusted-presenter',
          presenterLabel: 'Studio laptop',
        }),
        joystickTrustedPresenterHarness.createSession({
          code: 'NEW1-2345',
          expiresAt: '2026-07-09T23:00:00.000Z',
          presenterDeviceId: 'untrusted-presenter',
          presenterLabel: 'Untrusted display',
        }),
      ],
    });

    const joystick = new JoystickAppPage(page, getServer().baseURL);
    await joystick.gotoRemote();

    await expect(page.getByRole('region', { name: 'Presenter mode required' })).toContainText(
      'Studio laptop',
    );
    await expect(page.getByRole('region', { name: 'Presenter mode required' })).toContainText(
      'Quarterly launch review',
    );
    await expect(page.getByText('Connected (2)')).toBeVisible();

    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_JOYSTICK__?.setPresenterMode('presenting');
    });

    await expect(page.getByLabel('Slide position')).toContainText('1 / 4');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 4');
    await expect(page.getByLabel('Presenter status')).toContainText('Build 1 of 2');
    await expect(page.getByLabel('Presentation timer')).toContainText(/00:0[4-9]/);
    await expect(page.getByLabel('Presenter notes content')).toContainText(
      'Open with the customer metric before the roadmap.',
    );
    const currentSlidePreview = page.getByLabel('Current slide preview');
    await expect(currentSlidePreview).toBeVisible();
    await expect(currentSlidePreview.getByLabel('Slide video')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to slide 2: Roadmap' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to slide 3: Risks' })).toBeVisible();

    const notesSizeBefore = await page
      .getByLabel('Presenter notes content')
      .evaluate((element) => getComputedStyle(element).fontSize);
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await expect
      .poll(() =>
        page
          .getByLabel('Presenter notes content')
          .evaluate((element) => getComputedStyle(element).fontSize),
      )
      .not.toBe(notesSizeBefore);
    await page.getByRole('button', { name: 'Decrease notes size' }).click();

    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await expect(page.getByText('Command sent: pause-timer')).toBeVisible();
    await page.getByRole('button', { name: 'Resume timer' }).click();
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset timer' }).click();
    await expect(page.getByLabel('Presentation timer')).toContainText('00:00');

    await page.getByRole('button', { name: 'Go to slide 2: Roadmap' }).click();
    await expect(page.getByLabel('Slide position')).toContainText('2 / 4');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 4');
    await currentSlidePreview.dispatchEvent('pointerdown', {
      clientX: 220,
      pointerType: 'touch',
    });
    await currentSlidePreview.dispatchEvent('pointerup', {
      clientX: 340,
      pointerType: 'touch',
    });
    await expect(page.getByLabel('Slide position')).toContainText('1 / 4');

    await currentSlidePreview.dispatchEvent('pointerdown', {
      clientX: 340,
      pointerType: 'touch',
    });
    await currentSlidePreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerType: 'touch',
    });
    await expect(page.getByLabel('Slide position')).toContainText('2 / 4');

    await page.getByRole('button', { name: 'Show slide navigation' }).click();
    const slideNavigation = page.getByRole('dialog', { name: 'Slide navigation' });
    await expect(slideNavigation.getByRole('button', { name: 'Go to slide 1: Overview' })).toBeVisible();
    await expect(slideNavigation.getByRole('button', { name: 'Go to slide 4: Close' })).toBeVisible();
    await slideNavigation.getByRole('button', { name: 'Go to slide 4: Close' }).click();
    await expect(page.getByLabel('Slide position')).toContainText('4 / 4');
    await expect(page.getByText('Presenter notes that are created will appear here')).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_JOYSTICK__?.commands ?? []))
      .toEqual(
        expect.arrayContaining([
          'pause-timer',
          'resume-timer',
          'reset-timer',
          'go-to-page:slide-2',
          'go-to-page:slide-1',
          'go-to-page:slide-2',
          'go-to-page:slide-4',
        ]),
      );
  });
});
