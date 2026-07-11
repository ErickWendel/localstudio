import { type Page } from '@playwright/test';

import { JoystickAppPage } from '../pages/joystick-app.page';
import { expect } from '../support/journey-test';
import { joystickTrustedPresenterHarness } from '../support/joystick-trusted-presenter-harness';

export const trustedReconnectJourney = {
  async run(page: Page, baseURL: string): Promise<void> {
    await page.setViewportSize({ width: 390, height: 844 });
    await installTrustedPresenter(page);

    const joystick = new JoystickAppPage(page, baseURL);
    await joystick.gotoRemote();

    await verifyPresenterModeRequired(page);
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_JOYSTICK__?.setPresenterMode('presenting');
    });

    const currentSlidePreview = page.getByLabel('Current slide preview');
    await verifyConnectedPresenterState(page, currentSlidePreview);
    await exerciseNotesAndTimerControls(page);
    await exerciseDirectSlideControls(page, currentSlidePreview);
    await exerciseSlideNavigation(page);
    await verifyCommandHistory(page);
  },
};

async function installTrustedPresenter(page: Page): Promise<void> {
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
}

async function verifyPresenterModeRequired(page: Page): Promise<void> {
  const presenterModeRequired = page.getByRole('region', { name: 'Presenter mode required' });
  await expect(presenterModeRequired).toContainText('Studio laptop');
  await expect(presenterModeRequired).toContainText('Quarterly launch review');
  await expect(page.getByText('Connected (2)')).toBeVisible();
}

async function verifyConnectedPresenterState(page: Page, currentSlidePreview: ReturnType<Page['getByLabel']>) {
  await expect(page.getByLabel('Slide position')).toContainText('1 / 4');
  await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 4');
  await expect(page.getByLabel('Presenter status')).toContainText('Build 1 of 2');
  await expect(page.getByLabel('Presentation timer')).toContainText(/00:0[4-9]/);
  await expect(page.getByLabel('Presenter notes content')).toContainText(
    'Open with the customer metric before the roadmap.',
  );
  await expect(currentSlidePreview).toBeVisible();
  await expect(currentSlidePreview.getByLabel('Slide video')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to slide 2: Roadmap' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to slide 3: Risks' })).toBeVisible();
}

async function exerciseNotesAndTimerControls(page: Page): Promise<void> {
  const notesSizeBefore = await page
    .getByLabel('Presenter notes content')
    .evaluate((element) => getComputedStyle(element).fontSize);
  await page.getByRole('button', { name: 'Increase notes size' }).click();
  await expect
    .poll(() =>
      page.getByLabel('Presenter notes content').evaluate((element) => getComputedStyle(element).fontSize),
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
}

async function exerciseDirectSlideControls(
  page: Page,
  currentSlidePreview: ReturnType<Page['getByLabel']>,
): Promise<void> {
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
}

async function exerciseSlideNavigation(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show slide navigation' }).click();
  const slideNavigation = page.getByRole('dialog', { name: 'Slide navigation' });
  await expect(slideNavigation.getByRole('button', { name: 'Go to slide 1: Overview' })).toBeVisible();
  await expect(slideNavigation.getByRole('button', { name: 'Go to slide 4: Close' })).toBeVisible();
  await slideNavigation.getByRole('button', { name: 'Go to slide 4: Close' }).click();
  await expect(page.getByLabel('Slide position')).toContainText('4 / 4');
  await expect(page.getByText('Presenter notes that are created will appear here')).toBeVisible();
}

async function verifyCommandHistory(page: Page): Promise<void> {
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
}
