import type { Page } from '@playwright/test';
import type {
  PresenterRemoteCommand,
  PresenterRemoteSession,
  PresenterRemoteSlidePreview,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';

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


export const joystickTrustedPresenterHarness = {
  createRemoteState,
  createSession,
  installTrustedPresenterRemote,
};
