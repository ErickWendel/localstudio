import { EditorAppPage } from '../pages/editor-app.page';
import { getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import type { Page as PlaywrightPage } from '@playwright/test';
import type { ProjectDocument, DesignElement, Page as SlidePage } from '../../../apps/editor/src/domain/documents/model';
import type {
  PresenterCommandMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from '../../../apps/editor/src/services/presenter/presenterSessionTypes';

const getServer = withIsolatedDevServer(test);

test.describe('editor presenter and notes journey', () => {
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
    await shortcuts.getByRole('button', { name: 'Hold to fast forward movie' }).click();
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).playbackRate))
      .toBe(2);
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

  test('writes notes and verifies presenter controls without requiring an external display', async ({ page }) => {
    test.setTimeout(60_000);

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
      timeout: 45_000,
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

  test('opens a routed presenter window and responds to editor state and timer commands', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await installPresenterWindowHarness(page);

    await page.goto(`${getServer().baseURL}/editor/?presenter=1&presenterSession=e2e-presenter`);
    await expect(page.getByRole('main', { name: 'Presenter view' })).toBeVisible();

    const introDismissButton = page.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible().catch(() => false)) {
      await introDismissButton.click();
    }

    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(page.getByLabel('Presenter status')).toContainText('Builds remaining: 1');
    await expect(page.getByLabel('Speaker notes')).toHaveValue('Open with the metric.');

    const notesResizer = page.getByRole('separator', { name: 'Resize presenter notes' });
    const notesWidthBefore = await notesResizer.getAttribute('aria-valuenow');
    await notesResizer.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(notesResizer).not.toHaveAttribute('aria-valuenow', notesWidthBefore ?? '');
    await page.keyboard.press('Home');
    await expect(notesResizer).toHaveAttribute('aria-valuenow', '280');
    await page.keyboard.press('End');

    const resizerBox = await notesResizer.boundingBox();
    expect(resizerBox).not.toBeNull();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + 40);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 120, resizerBox!.y + 40);
    await page.mouse.up();

    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('resume-timer');
    });
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('pause-timer');
    });
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('reset-timer');
    });
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();

    await page.getByLabel('Speaker notes').fill('Presenter route edited notes');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.notesFor('slide-1')))
      .toBe('Presenter route edited notes');

    await page.getByRole('button', { name: 'Show remote control QR code' }).click();
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeVisible();
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeHidden();

    await page.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await page.getByRole('button', { name: 'Decrease notes size' }).click();
    await page.getByRole('button', { name: 'Scroll notes down' }).click();
    await page.getByRole('button', { name: 'Scroll notes up' }).click();
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();

    await page.keyboard.press('Shift+Digit3');
    const slideNavigator = page.getByRole('dialog', { name: 'Slide navigator' });
    await expect(slideNavigator).toBeVisible();
    await page.keyboard.press('Equal');
    await expect(slideNavigator.getByRole('option', { name: /Slide 2.*Visual proof/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await page.keyboard.press('Shift+Digit3');
    await slideNavigator.getByRole('option', { name: /Slide 3.*Close/ }).dblclick();
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await page.keyboard.press('Home');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await page.keyboard.press('End');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');

    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.commands ?? []))
      .toEqual(
        expect.arrayContaining([
          'request-state',
          'resume-timer',
          'pause-timer',
          'update-notes:slide-1',
          'go-to-page:slide-2',
          'go-to-page:slide-3',
          'go-to-page:slide-1',
          'go-to-page:slide-3',
          'go-to-page:slide-2',
        ]),
      );
  });
});

type E2EPresenterHarness = {
  commands: string[];
  notesFor: (pageId: string) => string | undefined;
  sendCommand: (command: 'pause-timer' | 'reset-timer' | 'resume-timer') => void;
};

declare global {
  interface Window {
    __LOCALSTUDIO_E2E_PRESENTER__?: E2EPresenterHarness | undefined;
  }
}

async function installPresenterWindowHarness(page: PlaywrightPage) {
  const initialPayload = createPresenterPayload('slide-1');
  await page.addInitScript((payload) => {
    const sessionId = 'e2e-presenter';
    let currentPayload = payload;
    const commands: string[] = [];

    function sendState() {
      window.postMessage(
        {
          payload: currentPayload,
          sessionId,
          source: 'localstudio-presenter-main',
          type: 'state',
        },
        window.location.origin,
      );
    }

    function updateActivePage(pageId: string) {
      if (!currentPayload.project.pages.some((page) => page.id === pageId)) return;
      currentPayload = { ...currentPayload, activePageId: pageId };
      window.setTimeout(sendState, 0);
    }

    function moveActivePage(direction: -1 | 1) {
      const index = currentPayload.project.pages.findIndex(
        (page) => page.id === currentPayload.activePageId,
      );
      const nextPage = currentPayload.project.pages[index + direction];
      if (nextPage) updateActivePage(nextPage.id);
    }

    function recordCommand(command: PresenterWindowCommand) {
      if (command.command === 'go-to-page') {
        commands.push(`${command.command}:${command.pageId}`);
        updateActivePage(command.pageId);
        return;
      }
      if (command.command === 'update-notes') {
        commands.push(`${command.command}:${command.pageId}`);
        currentPayload = {
          ...currentPayload,
          project: {
            ...currentPayload.project,
            pages: currentPayload.project.pages.map((projectPage) =>
              projectPage.id === command.pageId
                ? { ...projectPage, speakerNotes: command.notes }
                : projectPage,
            ),
          },
        };
        window.setTimeout(sendState, 0);
        return;
      }
      commands.push(command.command);
      if (command.command === 'next') moveActivePage(1);
      if (command.command === 'previous') moveActivePage(-1);
      if (command.command === 'request-state') window.setTimeout(sendState, 0);
    }

    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: {
        postMessage: (message: PresenterCommandMessage) => {
          if (message.source !== 'localstudio-presenter-window') return;
          recordCommand(message);
        },
      },
    });

    window.__LOCALSTUDIO_E2E_PRESENTER__ = {
      commands,
      notesFor: (pageId: string) =>
        currentPayload.project.pages.find((projectPage) => projectPage.id === pageId)?.speakerNotes,
      sendCommand: (command) => {
        window.postMessage(
          {
            command,
            sessionId,
            source: 'localstudio-presenter-main',
            type: 'command',
          },
          window.location.origin,
        );
      },
    };
  }, initialPayload);
}

function createPresenterPayload(activePageId: string): PresenterStatePayload {
  return {
    activePageId,
    animationPreview: {
      hiddenElementIds: ['headline-1'],
      mode: 'presenter',
      pageId: 'slide-1',
      phase: 'idle',
      playing: false,
    },
    project: createPresenterProject(),
    remoteSession: {
      code: 'PRES-1234',
      connectedControllerCount: 1,
      expiresAt: '2026-07-10T00:00:00.000Z',
      presenterDeviceId: 'presenter-device',
      presenterLabel: 'Presenter laptop',
      qrUrl: 'https://localstudio.test/joystick/?code=PRES-1234',
      sessionId: 'presenter-session',
    },
  };
}

function createPresenterProject(): ProjectDocument {
  const imageUrl =
    'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22180%22%3E%3Crect%20width%3D%22320%22%20height%3D%22180%22%20fill%3D%22%232E6B57%22%2F%3E%3Ctext%20x%3D%2224%22%20y%3D%2296%22%20fill%3D%22white%22%20font-size%3D%2228%22%3EProof%3C%2Ftext%3E%3C%2Fsvg%3E';
  const pages: SlidePage[] = [
    createSlide({
      background: { type: 'color', color: '#111827' },
      elementIds: ['headline-1', 'shape-1'],
      id: 'slide-1',
      name: 'Opening',
      speakerNotes: 'Open with the metric.',
    }),
    createSlide({
      background: { type: 'asset', assetId: 'asset-proof', colorFallback: '#163B33' },
      elementIds: ['image-2', 'body-2', 'shape-2'],
      id: 'slide-2',
      name: 'Visual proof',
      speakerNotes: 'Point to the before and after visual.',
    }),
    createSlide({
      background: { type: 'color', color: '#F8FAF7' },
      elementIds: ['hidden-3', 'shape-3'],
      id: 'slide-3',
      name: 'Close',
      speakerNotes: '',
    }),
  ];
  return {
    assets: {
      'asset-proof': {
        id: 'asset-proof',
        mimeType: 'image/svg+xml',
        name: 'Proof graphic',
        objectUrl: imageUrl,
        type: 'image',
      },
    },
    createdAt: '2026-07-09T00:00:00.000Z',
    elements: {
      'body-2': createTextElement('body-2', 'Before and after comparison', 260, 500),
      'headline-1': createTextElement('headline-1', 'Launch readout', 180, 160),
      'hidden-3': { ...createTextElement('hidden-3', 'Hidden note', 200, 200), visible: false },
      'image-2': createImageElement('image-2', 'asset-proof', 140, 180),
      'shape-1': createShapeElement('shape-1', '#F2C94C', 240, 420),
      'shape-2': createShapeElement('shape-2', '#C6F6D5', 1120, 190),
      'shape-3': createShapeElement('shape-3', '#334155', 300, 260),
    },
    id: 'presenter-e2e-project',
    name: 'Presenter route deck',
    pages,
    updatedAt: '2026-07-09T00:00:00.000Z',
  };
}

function createSlide({
  background,
  elementIds,
  id,
  name,
  speakerNotes,
}: Pick<SlidePage, 'background' | 'elementIds' | 'id' | 'name' | 'speakerNotes'>): SlidePage {
  return {
    background,
    elementIds,
    height: 1080,
    id,
    name,
    speakerNotes,
    width: 1920,
    animationBuilds:
      id === 'slide-1'
        ? [
            {
              delayMs: 0,
              durationMs: 400,
              effect: 'fade',
              elementId: 'headline-1',
              id: 'build-headline',
              kind: 'build-in',
              trigger: 'on-click',
            },
          ]
        : undefined,
  };
}

function createTextElement(id: string, text: string, x: number, y: number): DesignElement {
  return {
    align: 'center',
    fill: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 84,
    fontWeight: 700,
    height: 160,
    id,
    lineHeight: 1.05,
    locked: false,
    opacity: 1,
    rotation: 0,
    text,
    type: 'text',
    verticalAlign: 'middle',
    visible: true,
    width: 900,
    x,
    y,
  };
}

function createImageElement(id: string, assetId: string, x: number, y: number): DesignElement {
  return {
    assetId,
    height: 360,
    id,
    locked: false,
    opacity: 1,
    rotation: 0,
    type: 'image',
    visible: true,
    width: 640,
    x,
    y,
  };
}

function createShapeElement(id: string, fill: string, x: number, y: number): DesignElement {
  return {
    fill,
    height: 220,
    id,
    locked: false,
    opacity: 0.94,
    rotation: 8,
    shape: 'rounded-rect',
    stroke: '#111827',
    strokeWidth: 3,
    type: 'shape',
    visible: true,
    width: 300,
    x,
    y,
  };
}
