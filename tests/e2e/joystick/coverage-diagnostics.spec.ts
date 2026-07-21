import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('joystick bundled runtime diagnostics coverage', () => {
  test('exercises joystick page branches through an explicit diagnostics route', async ({ page }) => {
    const url = new URL('/joystick/', getServer().baseURL);
    url.searchParams.set('e2eCoverageDiagnostics', '1');
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: undefined,
      });
      Object.defineProperties(HTMLVideoElement.prototype, {
        videoHeight: {
          configurable: true,
          get: () => 1,
        },
        videoWidth: {
          configurable: true,
          get: () => 1,
        },
      });
      HTMLMediaElement.prototype.play = () => Promise.resolve();
      HTMLCanvasElement.prototype.getContext = function getContext() {
        return {
          drawImage: () => undefined,
          getImageData: () => ({
            data: new Uint8ClampedArray([0, 0, 0, 255]),
            height: 1,
            width: 1,
          }),
        } as CanvasRenderingContext2D;
      };
    });

    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('main', { name: 'Joystick E2E coverage diagnostics' }),
    ).toBeVisible();

    const slidePreview = page
      .getByRole('region', { name: 'Slide preview diagnostics' })
      .getByRole('button', { name: 'Current slide preview' });
    const slidePreviewBox = await slidePreview.boundingBox();
    const slidePreviewRightX = Math.max(1, Math.floor((slidePreviewBox?.width ?? 240) - 2));
    await slidePreview.click({ position: { x: 8, y: 20 } });
    await slidePreview.click({ position: { x: slidePreviewRightX, y: 20 } });
    await slidePreview.dispatchEvent('touchend', {
      changedTouches: [],
    });
    await slidePreview.dispatchEvent('pointerdown', {
      clientX: 220,
      pointerId: 1,
      pointerType: 'touch',
    });
    await slidePreview.dispatchEvent('pointerup', {
      clientX: 120,
      pointerId: 1,
      pointerType: 'touch',
    });
    await slidePreview.dispatchEvent('pointerdown', {
      clientX: 120,
      pointerId: 3,
      pointerType: 'mouse',
    });
    await slidePreview.dispatchEvent('pointerup', {
      clientX: 120,
      pointerId: 3,
      pointerType: 'mouse',
    });
    await slidePreview.dispatchEvent('pointerdown', {
      clientX: 120,
      pointerId: 4,
      pointerType: 'touch',
    });
    await slidePreview.dispatchEvent('pointerup', {
      clientX: 130,
      pointerId: 4,
      pointerType: 'touch',
    });
    await slidePreview.dispatchEvent('pointerup', {
      clientX: 180,
      pointerId: 5,
      pointerType: 'touch',
    });
    await slidePreview.dispatchEvent('touchstart', {
      changedTouches: [{ clientX: 120, identifier: 1, target: await slidePreview.elementHandle() }],
    });
    await slidePreview.dispatchEvent('touchend', {
      changedTouches: [{ clientX: 220, identifier: 1, target: await slidePreview.elementHandle() }],
    });
    await slidePreview.dispatchEvent('touchstart', {
      changedTouches: [{ clientX: 220, identifier: 2, target: await slidePreview.elementHandle() }],
    });
    await slidePreview.dispatchEvent('touchend', {
      changedTouches: [{ clientX: 120, identifier: 2, target: await slidePreview.elementHandle() }],
    });

    const streamDiagnostics = page.getByRole('region', { name: 'Stream preview diagnostics' });
    const streamPreview = streamDiagnostics
      .getByRole('button', { name: 'Presenter stream preview' })
      .first();
    await streamPreview.click({ position: { x: 8, y: 20 } });
    await streamPreview.click({ position: { x: 220, y: 20 } });
    const streamVideo = streamPreview.locator('.joystick-stream-video');
    await streamVideo.dispatchEvent('waiting');
    await streamVideo.dispatchEvent('loadedmetadata');
    await streamVideo.dispatchEvent('canplay');
    await streamVideo.dispatchEvent('playing');
    await streamPreview.dispatchEvent('pointerdown', {
      clientX: 120,
      pointerId: 2,
      pointerType: 'pen',
    });
    await streamPreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerId: 2,
      pointerType: 'pen',
    });
    const blockedStreamPreview = streamDiagnostics
      .getByRole('button', { name: 'Presenter stream preview' })
      .nth(1);
    await blockedStreamPreview.click({ position: { x: 220, y: 20 } });
    await page.getByRole('button', { name: 'Hide rejecting stream' }).click();

    const scanButtons = page.getByRole('button', { name: 'Scan QR' });
    await scanButtons.nth(0).click();
    await expect(page.getByText('Camera scanning is not available in this browser.')).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.resolve(new MediaStream()),
        },
      });
    });
    await scanButtons.nth(0).click();
    await page.getByRole('button', { name: 'Stop scanning' }).click();
    await scanButtons.nth(1).click();
    await expect(page.getByLabel('Diagnostics result')).toContainText('scan:https://localstudio.test');
    await scanButtons.nth(2).click();
    await expect(page.getByText('Camera permission was blocked or unavailable.')).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperties(HTMLVideoElement.prototype, {
        videoHeight: {
          configurable: true,
          get: () => 0,
        },
        videoWidth: {
          configurable: true,
          get: () => 0,
        },
      });
    });
    await scanButtons.nth(3).click();
    await page.evaluate(
      () => new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined))),
    );
    await page.getByRole('button', { name: 'Stop scanning' }).click();
    await page.evaluate(() => {
      Object.defineProperties(HTMLVideoElement.prototype, {
        videoHeight: {
          configurable: true,
          get: () => 1,
        },
        videoWidth: {
          configurable: true,
          get: () => 1,
        },
      });
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await scanButtons.nth(3).click();
    await page.evaluate(
      () => new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined))),
    );
    await page.getByRole('button', { name: 'Stop scanning' }).click();

    const appDiagnostics = page.getByRole('region', { name: 'Joystick app diagnostics' });
    await expect(appDiagnostics.getByText('Builds remaining: 2')).toBeVisible();
    await expect(appDiagnostics.getByText('Could not connect to that presenter.').first()).toBeVisible();

    await expect(
      appDiagnostics.getByRole('region', { name: 'Streamed presenter preview' }).first(),
    ).toBeVisible();
    const streamRemote = appDiagnostics;
    const remoteControls = streamRemote.getByLabel('Remote controls').first();
    await remoteControls.getByRole('button', { name: 'Previous build' }).click();
    await remoteControls.getByRole('button', { name: 'Pause timer' }).click();
    await remoteControls.getByRole('button', { name: 'Reset timer' }).click();
    await remoteControls.getByRole('button', { name: 'Show slide navigation' }).click();
    await expect(streamRemote.getByRole('dialog', { name: 'Slide navigation' })).toBeVisible();
    await streamRemote.getByRole('button', { name: 'Close slide navigation' }).click();
    const streamApp = streamRemote.locator('.joystick-app-stream').first();
    const resizeHandle = streamApp.getByRole('button', { name: 'Resize presenter notes' });
    await streamApp.getByRole('button', { name: 'Increase notes size' }).click();
    await resizeHandle.dispatchEvent('pointerdown', {
      clientY: 500,
      pointerId: 9,
      pointerType: 'touch',
    });
    await page.mouse.move(0, 420);
    await page.mouse.up();
    await page.getByRole('button', { name: 'Hide peer stream app' }).click();
    await page.getByRole('button', { name: 'Hide cancelled peer app' }).click();

    await expect(page.getByLabel('Navigation result')).toContainText('previous');
    await expect(page.getByLabel('Navigation result')).toContainText('next');
  });
});
