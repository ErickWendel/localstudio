import type { PresenterRemoteState } from './protocol';
import { presenterRemoteDebugLog } from './debug-log';

const peerDataChannelMaxStateBytes = 16_000;

function createSafeState(state: PresenterRemoteState): PresenterRemoteState {
  const stateBytes = getJsonByteLength(state);
  if (stateBytes <= peerDataChannelMaxStateBytes) return state;
  const safeState: PresenterRemoteState = {
    ...state,
    nextSlidePreview: undefined,
    pages: state.pages?.map((page) => ({
      id: page.id,
      name: page.name,
    })),
    slidePreview: undefined,
    upcomingSlidePreviews: [],
  };
  presenterRemoteDebugLog.warn(
    'Remote state was too large for PeerJS data channel; using stream-only state.',
    {
      safeBytes: getJsonByteLength(safeState),
      stateBytes,
    },
  );
  return safeState;
}

function getJsonByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export const presenterRemoteDataChannelState = {
  createSafeState,
  getJsonByteLength,
} as const;
