import type { Page as PlaywrightPage } from '@playwright/test';
import type {
  DesignElement,
  Page as SlidePage,
  ProjectDocument,
} from '../../../apps/editor/src/domain/documents/model';
import type {
  PresenterCommandMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from '../../../apps/editor/src/services/presenter/presenterSessionTypes';

type E2EPresenterHarness = {
  activePageId: () => string;
  commands: string[];
  notesFor: (pageId: string) => string | undefined;
  sendCommand: (command: 'pause-timer' | 'reset-timer' | 'resume-timer') => void;
};

declare global {
  interface Window {
    __LOCALSTUDIO_E2E_PRESENTER__?: E2EPresenterHarness | undefined;
  }
}

async function install(page: PlaywrightPage) {
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
      activePageId: () => currentPayload.activePageId,
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

export const presenterRouteHarness = {
  install,
};
