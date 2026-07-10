import type { Page } from '@playwright/test';
import type {
  PresenterRemoteCommand,
  PresenterRemoteSession,
  PresenterRemoteSlidePreview,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';
import { JoystickAppPage } from '../pages/joystick-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('joystick pair and control journey', () => {
  test('shows pairing and disabled controls before a presenter is connected', async ({ page }) => {
    const joystick = new JoystickAppPage(page, getServer().baseURL);
    await joystick.gotoRemote();

    await expect(page.getByLabel('Slide position')).toContainText('-- / --');
    await expect(page.getByLabel('Presentation timer')).toContainText('00:00');
    await expect(page.getByRole('textbox', { name: 'Remote link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reset timer' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Show slide navigation' })).toBeDisabled();

    await page
      .getByRole('textbox', { name: 'Remote link' })
      .fill('https://localstudio.test/joystick/?peer=invalid-presenter-peer');
    await expect(page.getByRole('textbox', { name: 'Remote link' })).toHaveValue('invalid-presenter-peer');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page.getByText(/Looking for the presenter session|Could not connect/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
  });

  test('reconnects a trusted phone and controls a non-peer presenter session', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installTrustedPresenterRemote(page, {
      initialState: createRemoteState('ready'),
      sessions: [
        createSession({
          code: 'A1D1-2345',
          expiresAt: '2026-07-09T20:00:00.000Z',
          presenterDeviceId: 'trusted-presenter',
          presenterLabel: 'Old presenter display',
        }),
        createSession({
          code: 'TRU5-7ED1',
          expiresAt: '2026-07-09T22:00:00.000Z',
          presenterDeviceId: 'trusted-presenter',
          presenterLabel: 'Studio laptop',
        }),
        createSession({
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

type E2EJoystickRemote = {
  commands: string[];
  setPresenterMode: (presenterMode: PresenterRemoteState['presenterMode']) => void;
};

declare global {
  interface Window {
    __LOCALSTUDIO_E2E_JOYSTICK__?: E2EJoystickRemote | undefined;
    __LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__?:
      | {
          connectController?: (code: string) => PresenterRemoteSession | undefined;
          getPublishedState?: () => PresenterRemoteState;
          listSessions?: () => PresenterRemoteSession[];
          lookupSession: (code: string) => PresenterRemoteSession | undefined;
          publishCommand: (
            code: string,
            command: PresenterRemoteCommand,
            controllerId?: string,
          ) => boolean;
        }
      | undefined;
  }
}

function createSession({
  code,
  expiresAt,
  presenterDeviceId,
  presenterLabel,
}: {
  code: string;
  expiresAt: string;
  presenterDeviceId: string;
  presenterLabel: string;
}): PresenterRemoteSession {
  return {
    code,
    connectedControllerCount: 1,
    expiresAt,
    presenterDeviceId,
    presenterLabel,
    sessionId: `session-${code}`,
  };
}

function createRemoteState(presenterMode: PresenterRemoteState['presenterMode']): PresenterRemoteState {
  const previews = [
    createPreview('Overview', '#17212B'),
    createPreview('Roadmap', '#2E6B57'),
    createPreview('Risks', '#75443E'),
    createPreview('Close', '#27334D'),
  ];
  return {
    activePageId: 'slide-1',
    activePageIndex: 0,
    activePageName: 'Overview',
    builds: { current: 1, remaining: 1, total: 2 },
    buildsRemaining: 1,
    commandAvailability: ['previous', 'next', 'pause-timer', 'reset-timer'],
    connectedControllerCount: 2,
    deckName: 'Quarterly launch review',
    nextPageName: 'Roadmap',
    nextSlidePreview: previews[1],
    notes: 'Open with the customer metric before the roadmap.',
    pageCount: 4,
    pages: [
      { id: 'slide-1', name: 'Overview', preview: previews[0] },
      { id: 'slide-2', name: 'Roadmap' },
      { id: 'slide-3', name: 'Risks', preview: previews[2] },
      { id: 'slide-4', name: 'Close' },
    ],
    presenterMode,
    previewMode: 'structured-fallback',
    shortcuts: ['Swipe to move between slides'],
    slidePreview: previews[0],
    timer: {
      elapsedMs: 4_000,
      paused: false,
      updatedAtEpochMs: Date.now(),
    },
    type: 'state',
    upcomingSlidePreviews: [
      { pageId: 'slide-2', pageName: 'Roadmap', preview: previews[1] },
      { pageId: 'slide-4', pageName: 'Close', preview: previews[3] },
    ],
  };
}

function createPreview(label: string, backgroundColor: string): PresenterRemoteSlidePreview {
  const encodedSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${backgroundColor}"/><text x="28" y="96" fill="white" font-size="28">${label}</text></svg>`,
  );
  const imageUrl = `data:image/svg+xml,${encodedSvg}`;
  return {
    backgroundColor,
    backgroundImageUrl: imageUrl,
    elements: [
      {
        assetUrl: imageUrl,
        height: 180,
        id: `${label}-image`,
        kind: 'image',
        opacity: 0.88,
        rotation: 0,
        width: 320,
        x: 96,
        y: 78,
      },
      {
        fill: '#FFFFFF',
        fontFamily: 'Inter',
        fontSize: 84,
        fontWeight: 700,
        height: 140,
        id: `${label}-title`,
        kind: 'text',
        lineHeight: 1.05,
        opacity: 1,
        rotation: 0,
        text: label,
        verticalAlign: 'middle',
        width: 900,
        x: 180,
        y: 110,
        align: 'center',
      },
      {
        fill: '#F2C94C',
        height: 120,
        id: `${label}-shape`,
        kind: 'shape',
        opacity: 0.9,
        rotation: 6,
        shape: 'rounded-rect',
        stroke: '#111827',
        strokeWidth: 4,
        width: 220,
        x: 1380,
        y: 120,
      },
      {
        assetUrl: imageUrl,
        height: 150,
        id: `${label}-gif`,
        kind: 'media',
        mediaType: 'gif',
        opacity: 1,
        rotation: 0,
        width: 220,
        x: 1320,
        y: 650,
      },
      {
        assetUrl: imageUrl,
        autoplay: false,
        height: 150,
        id: `${label}-video`,
        kind: 'media',
        loop: false,
        mediaType: 'video',
        muted: true,
        opacity: 1,
        rotation: 0,
        width: 260,
        x: 980,
        y: 640,
      },
      {
        height: 120,
        id: `${label}-missing-media`,
        kind: 'media',
        mediaType: 'video',
        opacity: 0.75,
        rotation: 0,
        width: 180,
        x: 720,
        y: 660,
      },
    ],
    height: 1080,
    width: 1920,
  };
}

async function installTrustedPresenterRemote(
  page: Page,
  config: {
    initialState: PresenterRemoteState;
    sessions: PresenterRemoteSession[];
  },
) {
  await page.addInitScript(({ initialState, sessions }) => {
    const trustedPresenterDeviceId = 'trusted-presenter';
    window.localStorage.setItem(
      'localstudio.joystick.trustedPresenterDeviceIds',
      JSON.stringify([trustedPresenterDeviceId]),
    );

    let state = initialState;
    const commands: string[] = [];

    function setActivePage(pageId: string) {
      const targetIndex = state.pages?.findIndex((page) => page.id === pageId) ?? -1;
      if (targetIndex < 0) return;
      const targetPage = state.pages?.[targetIndex];
      const nextPage = state.pages?.[targetIndex + 1];
      const upcomingSlidePreviews =
        state.pages?.slice(targetIndex + 1, targetIndex + 4).map((page) => ({
          pageId: page.id,
          pageName: page.name,
          preview: page.preview ?? state.upcomingSlidePreviews?.find((item) => item.pageId === page.id)?.preview,
        })) ?? [];
      state = {
        ...state,
        activePageId: pageId,
        activePageIndex: targetIndex,
        activePageName: targetPage?.name,
        builds: targetIndex === 0 ? { current: 1, remaining: 1, total: 2 } : undefined,
        buildsRemaining: targetIndex === 0 ? 1 : 0,
        nextPageName: nextPage?.name,
        nextSlidePreview: upcomingSlidePreviews[0]?.preview,
        notes: targetIndex === 3 ? '' : state.notes,
        slidePreview: targetPage?.preview ?? state.slidePreview,
        upcomingSlidePreviews,
      };
    }

    window.__LOCALSTUDIO_E2E_JOYSTICK__ = {
      commands,
      setPresenterMode: (presenterMode) => {
        state = { ...state, presenterMode };
      },
    };

    window.__LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__ = {
      connectController: (code: string) => {
        const session = sessions.find((item) => item.code === code);
        return session ? { ...session, connectedControllerCount: 2 } : undefined;
      },
      getPublishedState: () => state,
      listSessions: () => sessions,
      lookupSession: (code: string) => sessions.find((session) => session.code === code),
      publishCommand: (_code: string, command: PresenterRemoteCommand) => {
        commands.push(
          command.command === 'go-to-page' ? `${command.command}:${command.pageId}` : command.command,
        );
        if (command.command === 'go-to-page') setActivePage(command.pageId);
        if (command.command === 'previous') {
          const previousPage = state.pages?.[state.activePageIndex - 1];
          if (previousPage) setActivePage(previousPage.id);
        }
        if (command.command === 'next') {
          const nextPage = state.pages?.[state.activePageIndex + 1];
          if (nextPage) setActivePage(nextPage.id);
        }
        if (command.command === 'pause-timer') {
          state = { ...state, timer: { ...state.timer, paused: true } };
        }
        if (command.command === 'resume-timer') {
          state = {
            ...state,
            timer: { ...state.timer, paused: false, updatedAtEpochMs: Date.now() },
          };
        }
        if (command.command === 'reset-timer') {
          state = {
            ...state,
            timer: { elapsedMs: 0, paused: true, updatedAtEpochMs: Date.now() },
          };
        }
        return true;
      },
    };
  }, config);
}
