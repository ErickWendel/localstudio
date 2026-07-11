import type { PresenterStatePayload } from '../../../apps/editor/src/services/presenter/presenterSessionTypes';

import { presenterRouteProject } from './presenter-route-project';

export const presenterRoutePayload = {
  create(activePageId: string): PresenterStatePayload {
    return {
      activePageId,
      animationPreview: {
        hiddenElementIds: ['headline-1'],
        mode: 'presenter',
        pageId: 'slide-1',
        phase: 'idle',
        playing: false,
      },
      project: presenterRouteProject.create(),
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
  },
};
