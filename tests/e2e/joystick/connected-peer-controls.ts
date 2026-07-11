import { assertConnectedPeerInitialState } from './connected-peer-initial-state';
import { resizeConnectedPeerPresenterNotes } from './connected-peer-notes-resize';
import { verifyConnectedPeerReloadReconnect } from './connected-peer-reconnect';
import { exerciseConnectedPeerSlideButtons } from './connected-peer-slide-buttons';
import { exerciseConnectedPeerSlideNavigation } from './connected-peer-slide-navigation';
import { exerciseConnectedPeerStreamGestures } from './connected-peer-stream-gestures';
import { exerciseConnectedPeerTimer } from './connected-peer-timer';

export const connectedPeerControls = {
  assertInitialState: assertConnectedPeerInitialState,
  exerciseSlideButtons: exerciseConnectedPeerSlideButtons,
  exerciseSlideNavigation: exerciseConnectedPeerSlideNavigation,
  exerciseStreamGestures: exerciseConnectedPeerStreamGestures,
  exerciseTimer: exerciseConnectedPeerTimer,
  resizePresenterNotes: resizeConnectedPeerPresenterNotes,
  verifyReloadReconnect: verifyConnectedPeerReloadReconnect,
};
