/* eslint-disable @typescript-eslint/require-await, react-hooks/set-state-in-effect, react-hooks/use-memo */
import { useEffect, useMemo, useState } from 'react';
import type {
  PresenterRemotePreviewBatch,
  PresenterRemoteSession,
  PresenterRemoteSlidePreview,
  PresenterRemoteSlidePreviewElement,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';
import { JoystickApp } from '../JoystickApp';
import type { JoystickSignalingService } from '../JoystickApp';
import { JoystickQrScanner } from '../JoystickQrScanner';
import { SlideCanvas } from '../SlideCanvas';
import { SlidePreview } from '../SlidePreview';
import { StreamPreview } from '../StreamPreview';
import { joystickRemoteLink } from '../joystick-remote-link';
import { joystickRemotePreviews } from '../joystick-remote-previews';
import { joystickSessionStorage } from '../joystick-session-storage';

function createElement(
  element: Partial<PresenterRemoteSlidePreviewElement> & {
    id: string;
    kind: PresenterRemoteSlidePreviewElement['kind'];
  },
): PresenterRemoteSlidePreviewElement {
  const { id, kind, ...rest } = element;
  return {
    height: 160,
    id,
    kind,
    opacity: 0.92,
    rotation: 4,
    width: 320,
    x: 40,
    y: 40,
    ...rest,
  } as PresenterRemoteSlidePreviewElement;
}

function createPreview(): PresenterRemoteSlidePreview {
  const imageUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 9%22%3E%3Crect width=%2216%22 height=%229%22 fill=%22%2327354a%22/%3E%3C/svg%3E';
  return {
    backgroundColor: '#101827',
    backgroundImageUrl: imageUrl,
    elements: [
      createElement({ assetUrl: imageUrl, id: 'image-ready', kind: 'image' }),
      createElement({ id: 'image-missing', kind: 'image' }),
      createElement({ assetUrl: imageUrl, id: 'gif-ready', kind: 'media', mediaType: 'gif' }),
      createElement({
        assetUrl: imageUrl,
        autoplay: true,
        id: 'video-ready',
        kind: 'media',
        loop: true,
        mediaType: 'video',
        muted: true,
      }),
      createElement({ assetUrl: imageUrl, id: 'media-placeholder', kind: 'media' }),
      createElement({
        align: 'right',
        fill: '#f8fafc',
        fontFamily: 'Inter',
        fontSize: 46,
        fontWeight: 700,
        height: 180,
        hyperlink: 'https://localstudio.test',
        id: 'link-text',
        kind: 'text',
        lineHeight: 1.2,
        text: 'Linked text',
        verticalAlign: 'bottom',
      }),
      createElement({
        align: 'center',
        fill: '#bfdbfe',
        fontFamily: 'Inter',
        fontSize: 32,
        fontWeight: 600,
        hyperlink: 'https://localstudio.test/middle',
        id: 'link-text-middle',
        kind: 'text',
        text: 'Centered link',
        verticalAlign: 'middle',
      }),
      createElement({
        fill: '#fde68a',
        fontFamily: 'Inter',
        fontSize: 30,
        fontWeight: 400,
        hyperlink: 'https://localstudio.test/top',
        id: 'link-text-top',
        kind: 'text',
        text: 'Default link',
      }),
      createElement({
        align: 'center',
        fill: '#dbeafe',
        fontFamily: 'Inter',
        fontSize: 34,
        fontWeight: 500,
        id: 'center-text',
        kind: 'text',
        text: 'Centered text',
        verticalAlign: 'middle',
      }),
      createElement({
        align: 'right',
        fill: '#fecaca',
        fontFamily: 'Inter',
        fontSize: 30,
        fontWeight: 400,
        id: 'right-bottom-text',
        kind: 'text',
        text: 'Right bottom',
        verticalAlign: 'bottom',
      }),
      createElement({
        fill: '#bbf7d0',
        fontFamily: 'Inter',
        fontSize: 28,
        fontWeight: 400,
        id: 'default-text',
        kind: 'text',
        text: 'Default text',
      }),
      createElement({
        fill: '#22c55e',
        id: 'rounded-shape',
        kind: 'shape',
        shape: 'rounded-rect',
        stroke: '#052e16',
        strokeWidth: 3,
      }),
      createElement({
        id: 'transparent-shape',
        kind: 'shape',
        shape: 'rect',
        stroke: '#94a3b8',
        strokeWidth: 1,
      }),
      createElement({ id: 'unknown-element', kind: 'unknown' as 'shape' }),
    ],
    height: 1080,
    width: 1920,
  };
}

function createState(preview: PresenterRemoteSlidePreview): PresenterRemoteState {
  return {
    activePageId: 'slide-1',
    activePageIndex: 0,
    activePageName: 'Overview',
    builds: { current: 1, remaining: 1, total: 3 },
    buildsRemaining: 2,
    commandAvailability: ['previous', 'next', 'pause-timer', 'reset-timer'],
    connectedControllerCount: 1,
    deckName: 'Diagnostics deck',
    nextPageName: 'Roadmap',
    nextSlidePreview: preview,
    notes: 'Diagnostics notes',
    pageCount: 4,
    pages: [
      { id: 'slide-1', name: 'Overview', preview },
      { id: 'slide-2', name: 'Roadmap' },
      { id: 'slide-3', name: 'Risks', preview },
      { id: 'slide-4', name: 'Close' },
    ],
    presenterMode: 'presenting',
    previewMode: 'structured-fallback',
    shortcuts: [],
    slidePreview: preview,
    timer: { elapsedMs: 1_250, paused: false, updatedAtEpochMs: Date.now() },
    type: 'state',
    upcomingSlidePreviews: [{ pageId: 'slide-2', pageName: 'Roadmap', preview }],
  };
}

function createSession(code: string, presenterDeviceId: string, expiresAt: string): PresenterRemoteSession {
  return {
    code,
    connectedControllerCount: 1,
    expiresAt,
    presenterDeviceId,
    presenterLabel: presenterDeviceId,
    sessionId: presenterDeviceId,
  };
}

function createDiagnosticSignalingService({
  publishedState,
  sessions = [],
}: {
  publishedState: PresenterRemoteState;
  sessions?: PresenterRemoteSession[] | undefined;
}): JoystickSignalingService {
  return {
    getPublishedState: async () => publishedState,
    listSessions: async () => sessions,
    lookupSession: async (code) => sessions.find((session) => session.code === code),
    publishCommand: async () => true,
  };
}

export function JoystickCoverageDiagnosticsPage() {
  const preview = useMemo(createPreview, []);
  const remoteState = useMemo(() => createState(preview), [preview]);
  const [result, setResult] = useState('pending');
  const [navigation, setNavigation] = useState<string[]>([]);
  const [stream] = useState(() => new MediaStream());
  const [showPeerStreamApp, setShowPeerStreamApp] = useState(true);
  const [showCancelledPeerApp, setShowCancelledPeerApp] = useState(true);
  const [showRejectingStream, setShowRejectingStream] = useState(true);
  const [scannerStream] = useState(() => new MediaStream());
  const [trustedDiagnosticsReady, setTrustedDiagnosticsReady] = useState(false);
  const diagnosticSessions = useMemo(
    () => [
      createSession('ABCD-1234', 'diagnostic-code-device', '2030-01-01T00:00:00.000Z'),
      createSession('WXYZ-9876', 'diagnostic-trusted-device', '2031-01-01T00:00:00.000Z'),
    ],
    [],
  );
  const diagnosticSignalingService = useMemo(
    () =>
      createDiagnosticSignalingService({
        publishedState: remoteState,
        sessions: diagnosticSessions,
      }),
    [diagnosticSessions, remoteState],
  );
  const connectingDiagnosticSignalingService = useMemo(
    () => ({
      ...diagnosticSignalingService,
      connectController: async (code: string) =>
        diagnosticSessions.find((session) => session.code === code),
    }),
    [diagnosticSessions, diagnosticSignalingService],
  );
  const buildsRemainingState = useMemo(
    () => ({
      ...remoteState,
      builds: undefined,
      buildsRemaining: 2,
    }),
    [remoteState],
  );
  const buildsRemainingSignalingService = useMemo(
    () =>
      createDiagnosticSignalingService({
        publishedState: buildsRemainingState,
        sessions: diagnosticSessions,
      }),
    [buildsRemainingState, diagnosticSessions],
  );
  const peerDiagnosticsFactory = useMemo(
    () => (options: Parameters<NonNullable<Parameters<typeof JoystickApp>[0]['peerControlClientFactory']>>[0]) => ({
      close: () => undefined,
      sendCommand: () => true,
      start: async () => {
        options.onStatusChange?.('connecting');
        options.onStatusChange?.('connected');
        options.onState({
          ...remoteState,
          previewMode: 'stream',
          stream: {
            enabled: true,
            fps: 30,
            height: 720,
            peerId: 'diagnostic-stream-peer',
            transport: 'peerjs',
            width: 1280,
          },
        });
        options.onPreviewBatch?.({
          previews: [{ id: 'slide-2', name: 'Roadmap', preview }],
          requestId: 'peer-diagnostics',
          type: 'preview-batch',
        });
        options.onStatusChange?.('connected');
      },
    }),
    [preview, remoteState],
  );
  const failedRememberedPeerDiagnosticsFactory = useMemo(
    () => (options: Parameters<NonNullable<Parameters<typeof JoystickApp>[0]['peerControlClientFactory']>>[0]) => ({
      close: () => undefined,
      sendCommand: () => true,
      start: async () => {
        joystickSessionStorage.rememberSuccessfulPeer('remembered-failed-peer');
        options.onStatusChange?.('failed');
      },
    }),
    [],
  );
  const cancelledPeerDiagnosticsFactory = useMemo(
    () => (options: Parameters<NonNullable<Parameters<typeof JoystickApp>[0]['peerControlClientFactory']>>[0]) => ({
      close: () => {
        options.onStatusChange?.('connecting');
      },
      sendCommand: () => true,
      start: async () => undefined,
    }),
    [],
  );
  const rejectingPeerDiagnosticsFactory = useMemo(
    () => () => ({
      close: () => undefined,
      sendCommand: () => false,
      start: async () => {
        throw new Error('peer failed');
      },
    }),
    [],
  );
  const streamReceiverDiagnosticsFactory = useMemo(
    () => (options: Parameters<NonNullable<Parameters<typeof JoystickApp>[0]['peerStreamReceiverFactory']>>[0]) => ({
      start: async () => {
        options.onStatusChange('connected');
        options.onStream(new MediaStream());
      },
      stop: () => undefined,
    }),
    [],
  );
  const failingStreamReceiverDiagnosticsFactory = useMemo(
    () => (options: Parameters<NonNullable<Parameters<typeof JoystickApp>[0]['peerStreamReceiverFactory']>>[0]) => ({
      start: async () => {
        options.onStatusChange('failed');
        options.onStream(new MediaStream());
      },
      stop: () => undefined,
    }),
    [],
  );
  const missingSessionSignalingService = useMemo(
    () =>
      createDiagnosticSignalingService({
        publishedState: remoteState,
      }),
    [remoteState],
  );
  const scannerRuntime = useMemo(
    () => ({
      canUseCameraScanner: () => true,
      getUserMedia: async () => scannerStream,
      loadQrDecoder: async () => () => ({
        binaryData: [],
        chunks: [],
        data: 'https://localstudio.test/joystick/?peer=scanned-peer',
        location: {
          bottomLeftCorner: { x: 0, y: 1 },
          bottomRightCorner: { x: 1, y: 1 },
          bottomRightFinderPattern: { x: 1, y: 1 },
          topLeftCorner: { x: 0, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          topRightCorner: { x: 1, y: 0 },
          topRightFinderPattern: { x: 1, y: 0 },
        },
        version: 1,
      }),
    }),
    [scannerStream],
  );
  const scannerPermissionErrorRuntime = useMemo(
    () => ({
      canUseCameraScanner: () => true,
      getUserMedia: async () => {
        throw new Error('blocked');
      },
      loadQrDecoder: async () => () => undefined,
    }),
    [],
  );
  const scannerNoResultRuntime = useMemo(
    () => ({
      canUseCameraScanner: () => true,
      getUserMedia: async () => scannerStream,
      loadQrDecoder: async () => () => undefined,
    }),
    [scannerStream],
  );

  useEffect(() => {
    const batch: PresenterRemotePreviewBatch = {
      previews: [{ id: 'slide-2', name: 'Roadmap', preview }],
      requestId: 'diagnostics',
      type: 'preview-batch',
    };
    const merged = joystickRemotePreviews.mergePreviewBatchIntoState(remoteState, batch);
    const unchanged = joystickRemotePreviews.mergePreviewBatchIntoState(remoteState, {
      previews: [],
      requestId: 'empty',
      type: 'preview-batch',
    });
    const upcomingWithoutPages = joystickRemotePreviews.getUpcomingSlidePreviews({
      ...remoteState,
      pages: [],
    });
    const upcomingWithoutState = joystickRemotePreviews.getUpcomingSlidePreviews(undefined);
    const upcomingWithoutOptionalLists = joystickRemotePreviews.getUpcomingSlidePreviews({
      ...remoteState,
      nextSlidePreview: undefined,
      pages: undefined,
      upcomingSlidePreviews: undefined,
    });
    const upcomingPastLastPage = joystickRemotePreviews.getUpcomingSlidePreviews({
      ...remoteState,
      activePageIndex: 4,
      upcomingSlidePreviews: [{ pageId: 'slide-9', pageName: 'Appendix', preview }],
    });
    const mergedWithMissingPreview = joystickRemotePreviews.mergePreviewBatchIntoState(
      {
        ...remoteState,
        nextSlidePreview: undefined,
        pages: [{ id: 'slide-1', name: 'Overview' }],
        upcomingSlidePreviews: undefined,
      },
      {
        previews: [{ id: 'slide-2', name: 'Roadmap', preview }],
        requestId: 'missing-preview',
        type: 'preview-batch',
      },
    );
    const linkResults = [
      joystickRemoteLink.getCode('https://localstudio.test/joystick/?code=abcd-1234'),
      joystickRemoteLink.getCode('ABCD-1234'),
      joystickRemoteLink.getPeerId('https://localstudio.test/joystick/?peer=peer-123'),
      joystickRemoteLink.getPeerId('   '),
      joystickRemoteLink.getPeerId('ABCD-1234'),
      joystickRemoteLink.getPeerId('plain-peer'),
    ];

    joystickSessionStorage.rememberSuccessfulPeer(' peer-diagnostics ');
    joystickSessionStorage.forgetRememberedPeer();
    joystickSessionStorage.rememberSuccessfulPeer('   ');
    joystickSessionStorage.rememberSuccessfulSession(
      createSession('ABCD-1234', 'trusted-device', '2030-01-01T00:00:00.000Z'),
    );
    window.localStorage.setItem('localstudio.joystick.trustedPresenterDeviceIds', '{}');
    const invalidListTrusted = joystickSessionStorage.getNewestTrustedSession([
      createSession('IJKL-2468', 'trusted-device', '2034-01-01T00:00:00.000Z'),
    ]);
    window.localStorage.setItem('localstudio.joystick.trustedPresenterDeviceIds', '{"broken":true');
    const invalidTrusted = joystickSessionStorage.getNewestTrustedSession([
      createSession('EFGH-5678', 'trusted-device', '2033-01-01T00:00:00.000Z'),
    ]);
    joystickSessionStorage.rememberSuccessfulSession(
      createSession('ABCD-1234', 'trusted-device', '2030-01-01T00:00:00.000Z'),
    );
    const trusted = joystickSessionStorage.getNewestTrustedSession([
      createSession('WXYZ-9876', 'untrusted-device', '2031-01-01T00:00:00.000Z'),
      createSession('ABCD-1234', 'trusted-device', '2032-01-01T00:00:00.000Z'),
    ]);
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('storage unavailable');
      },
    });
    const unavailableStorageCode = joystickSessionStorage.getRememberedCode();
    if (localStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', localStorageDescriptor);
    }

    setResult(
      JSON.stringify({
        invalidTrusted: invalidTrusted?.code ?? 'none',
        invalidListTrusted: invalidListTrusted?.code ?? 'none',
        linkResults,
        mergedWithMissingPreview: mergedWithMissingPreview.upcomingSlidePreviews?.length ?? 0,
        mergedPreview: merged.pages?.[1]?.preview ? 'merged' : 'missing',
        trusted: trusted?.code,
        unchanged: unchanged === remoteState,
        unavailableStorageCode,
        upcomingWithoutPages: upcomingWithoutPages.length,
        upcomingWithoutOptionalLists: upcomingWithoutOptionalLists.length,
        upcomingPastLastPage: upcomingPastLastPage.length,
        upcomingWithoutState: upcomingWithoutState.length,
      }),
    );
  }, [preview, remoteState]);

  useEffect(() => {
    window.localStorage.removeItem('localstudio.joystick.lastCode');
    window.localStorage.removeItem('localstudio.joystick.lastPeerId');
    window.localStorage.setItem(
      'localstudio.joystick.trustedPresenterDeviceIds',
      JSON.stringify(['diagnostic-trusted-device']),
    );
    window.localStorage.setItem('localstudio.joystick.lastPeerId', 'remembered-failed-peer');
    setTrustedDiagnosticsReady(true);
  }, []);

  function recordNavigation(direction: 'next' | 'previous') {
    setNavigation((current) => [...current, direction]);
  }

  return (
    <main aria-label="Joystick E2E coverage diagnostics">
      <section aria-label="Slide canvas diagnostics">
        <SlideCanvas preview={undefined} />
        <SlideCanvas compact preview={undefined} />
        <SlideCanvas preview={preview} />
        <SlideCanvas compact preview={preview} renderMediaAssets={false} />
      </section>
      <section aria-label="Slide preview diagnostics">
        <SlidePreview preview={preview} onNavigate={recordNavigation} />
      </section>
      <section aria-label="Stream preview diagnostics">
        <StreamPreview fallbackPreview={preview} stream={stream} onNavigate={recordNavigation} />
        {showRejectingStream ? (
          <StreamPreview
            fallbackPreview={preview}
            runtime={{ playVideo: async () => Promise.reject(new Error('blocked')) }}
            stream={stream}
            onNavigate={recordNavigation}
          />
        ) : null}
        <button type="button" onClick={() => setShowRejectingStream(false)}>
          Hide rejecting stream
        </button>
      </section>
      <section aria-label="Scanner diagnostics">
        <JoystickQrScanner onScan={(value) => setResult(`scan:${value}`)} />
        <JoystickQrScanner
          onScan={(value) => setResult(`scan:${value}`)}
          runtime={scannerRuntime}
        />
        <JoystickQrScanner
          onScan={(value) => setResult(`error-scan:${value}`)}
          runtime={scannerPermissionErrorRuntime}
        />
        <JoystickQrScanner
          onScan={(value) => setResult(`pending-scan:${value}`)}
          runtime={scannerNoResultRuntime}
        />
      </section>
      <section aria-label="Joystick app diagnostics">
        <JoystickApp
          initialUrl="https://localstudio.test/joystick/?code=ABCD-1234"
          signalingService={diagnosticSignalingService}
        />
        <JoystickApp
          initialUrl="https://localstudio.test/joystick/?code=ABCD-1234&builds=remaining"
          signalingService={buildsRemainingSignalingService}
        />
        <JoystickApp
          initialUrl="https://localstudio.test/joystick/?code=ZZZZ-9999"
          signalingService={missingSessionSignalingService}
        />
        {trustedDiagnosticsReady ? (
          <JoystickApp
            initialUrl="https://localstudio.test/joystick/"
            signalingService={connectingDiagnosticSignalingService}
          />
        ) : null}
        {showPeerStreamApp ? (
          <JoystickApp
            initialUrl="https://localstudio.test/joystick/?peer=diagnostic-peer"
            peerControlClientFactory={peerDiagnosticsFactory}
            peerStreamReceiverFactory={streamReceiverDiagnosticsFactory}
            signalingService={diagnosticSignalingService}
          />
        ) : null}
        <button type="button" onClick={() => setShowPeerStreamApp(false)}>
          Hide peer stream app
        </button>
        {showCancelledPeerApp ? (
          <JoystickApp
            initialUrl="https://localstudio.test/joystick/?peer=cancelled-peer"
            peerControlClientFactory={cancelledPeerDiagnosticsFactory}
            signalingService={diagnosticSignalingService}
          />
        ) : null}
        <button type="button" onClick={() => setShowCancelledPeerApp(false)}>
          Hide cancelled peer app
        </button>
        <JoystickApp
          initialUrl="https://localstudio.test/joystick/?peer=rejecting-peer"
          peerControlClientFactory={rejectingPeerDiagnosticsFactory}
          signalingService={diagnosticSignalingService}
        />
        <JoystickApp
          initialUrl="https://localstudio.test/joystick/?peer=remembered-failed-peer"
          peerControlClientFactory={failedRememberedPeerDiagnosticsFactory}
          signalingService={diagnosticSignalingService}
        />
        <JoystickApp
          initialUrl="https://localstudio.test/joystick/?peer=failing-stream-peer"
          peerControlClientFactory={peerDiagnosticsFactory}
          peerStreamReceiverFactory={failingStreamReceiverDiagnosticsFactory}
          signalingService={diagnosticSignalingService}
        />
      </section>
      <output aria-label="Navigation result">{navigation.join(',')}</output>
      <output aria-label="Diagnostics result">{result}</output>
    </main>
  );
}
