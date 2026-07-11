import type { PresenterRemoteState } from '@localstudio/presenter-remote/protocol';

import { joystickTrustedPresenterPreview } from './joystick-trusted-presenter-preview';

export const joystickTrustedPresenterState = {
  create(presenterMode: PresenterRemoteState['presenterMode']): PresenterRemoteState {
    const previews = [
      joystickTrustedPresenterPreview.create('Overview', '#17212B'),
      joystickTrustedPresenterPreview.create('Roadmap', '#2E6B57'),
      joystickTrustedPresenterPreview.create('Risks', '#75443E'),
      joystickTrustedPresenterPreview.create('Close', '#27334D'),
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
  },
};
