/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/unbound-method, @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars */
import type { PptxPatcherContractInput } from './pptx-patcher-contract-fixtures';

type HighCoverageContractInput = {
  editorSourceRoot: string;
  pptx: PptxPatcherContractInput;
};

export async function evaluateEditorHighCoverageContract({
  editorSourceRoot,
  pptx,
}: HighCoverageContractInput) {
  function createSlideDocument(tasks: Array<Record<string, unknown>>, name = 'Web AI') {
    return {
      language: 'en',
      page: {
        background: { color: '#111827', type: 'color' },
        height: 1080,
        name,
        width: 1920,
      },
      tasks,
    };
  }

  function createTextElement(id: string, text = 'Demo') {
    return {
      align: 'left',
      fill: '#FFFFFF',
      fontFamily: 'Open Sans',
      fontSize: 36,
      fontWeight: 400,
      height: 80,
      id,
      opacity: 1,
      rotation: 0,
      text,
      type: 'text',
      width: 320,
      x: 0,
      y: 0,
    };
  }

  function createImageElement(id: string) {
    return {
      assetRole: 'placeholder',
      height: 180,
      id,
      opacity: 1,
      rotation: 0,
      type: 'image',
      width: 320,
      x: 0,
      y: 0,
    };
  }

  const [
    { pptxPackagePatcher },
    { progress },
    { transformersResultParsing },
    { slideLayoutPresets },
    { presenterRemoteStateFactory },
    { editorViewModelProject },
    { PresenterAudioRecorder },
    { PresenterSpeechTranscriber },
    { BrowserPresenterSessionService },
  ] = (await Promise.all([
    import(`${editorSourceRoot}/services/exporting/pptxPackagePatcher.ts`),
    import(`${editorSourceRoot}/services/model-setup/progress.ts`),
    import(`${editorSourceRoot}/services/model-setup/transformersResultParsing.ts`),
    import(`${editorSourceRoot}/services/prompting/slideLayoutPresets.ts`),
    import(`${editorSourceRoot}/services/presenter/presenterRemoteStateFactory.ts`),
    import(`${editorSourceRoot}/ui/editor/state/editorViewModelProject.ts`),
    import(`${editorSourceRoot}/services/transcription/presenterAudioRecorder.ts`),
    import(`${editorSourceRoot}/services/transcription/presenterSpeechTranscriber.ts`),
    import(`${editorSourceRoot}/services/presenter/presenterSessionService.ts`),
  ])) as [
    typeof import('../../../apps/editor/src/services/exporting/pptxPackagePatcher'),
    typeof import('../../../apps/editor/src/services/model-setup/progress'),
    typeof import('../../../apps/editor/src/services/model-setup/transformersResultParsing'),
    typeof import('../../../apps/editor/src/services/prompting/slideLayoutPresets'),
    typeof import('../../../apps/editor/src/services/presenter/presenterRemoteStateFactory'),
    typeof import('../../../apps/editor/src/ui/editor/state/editorViewModelProject'),
    typeof import('../../../apps/editor/src/services/transcription/presenterAudioRecorder'),
    typeof import('../../../apps/editor/src/services/transcription/presenterSpeechTranscriber'),
    typeof import('../../../apps/editor/src/services/presenter/presenterSessionService'),
  ];

  const pptxBytes = Uint8Array.from(atob(pptx.base64), (character) => character.charCodeAt(0));
  const patchedPptx = pptxPackagePatcher.patchPackageBuffer(
    pptxBytes.buffer,
    [
      ...pptx.pages,
      {
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['ghost'],
        height: 1080,
        id: 'missing-slide',
        name: 'Missing slide',
        transition: { delayMs: 0, durationMs: -5, effect: 'orbit', trigger: 'on-click' },
        visible: true,
        width: 1920,
      },
    ],
    pptx.warnings,
    pptx.patchPages,
  );

  const reportedProgress: Array<{ details?: unknown; value: number }> = [];
  const report = progress.createMonotonicProgressReporter((value, details) => {
    reportedProgress.push({ details, value });
  }, { initial: 15, max: 95, min: 10 });
  report(5);
  report(50, { loadedBytes: 50, totalBytes: 100 });
  report(120);
  const transformersProgress = progress.createTransformersProgressCallback((value, details) => {
    reportedProgress.push({ details, value });
  });
  transformersProgress({ file: 'a.bin', loaded: 20, name: 'model-a', status: 'progress', total: 100 });
  transformersProgress({ file: 'b.bin', loaded: 30, name: 'model-a', status: 'progress', total: 100 });
  transformersProgress({ loaded: 80, progress: 80, status: 'progress_total', total: 100 });
  transformersProgress({ progress: 20, status: 'progress' });
  const tickerValues: number[] = [];
  const stopTicker = progress.createEstimatedProgressTicker((value) => tickerValues.push(value), {
    intervalMs: 1,
    max: 23,
    start: 20,
    step: 2,
  });
  await new Promise((resolve) => window.setTimeout(resolve, 8));
  stopTicker();

  const generatedTexts = [
    transformersResultParsing.extractGeneratedText('plain'),
    transformersResultParsing.extractGeneratedText([{ content: 'chat content' }]),
    transformersResultParsing.extractGeneratedText([{ generated_text: [{ content: 'nested chat' }] }]),
    transformersResultParsing.extractGeneratedText({ generated_text: 'object text' }),
  ];
  const detectedLanguages = [
    transformersResultParsing.extractDetectedLanguage([[{ label: 'pt', score: 0.91 }]]),
    transformersResultParsing.extractDetectedLanguage({ label: 'en' }),
  ];
  const parsingErrors = [];
  try {
    transformersResultParsing.extractGeneratedText([{ output: 'missing' }]);
  } catch (error) {
    parsingErrors.push(error instanceof Error ? error.message : 'unknown');
  }
  try {
    transformersResultParsing.extractDetectedLanguage([{ score: 0.2 }]);
  } catch (error) {
    parsingErrors.push(error instanceof Error ? error.message : 'unknown');
  }

  const titleOnly = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([{ id: 'title', placementHint: '', text: 'Only title', type: 'add-title' }]),
    'make a title only slide',
  );
  const centered = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([], 'Fallback title'),
    'black background green title "Local AI" white subtitle "Runs here"',
  );
  const bullets = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([
      { description: 'Browser', id: 'hero-image', placementHint: 'left image', type: 'add-placeholder-image' },
      { id: 'title', placementHint: '', text: 'LocalStudio', type: 'add-title' },
      { id: 'one', placementHint: '', text: 'Overview privacy', type: 'add-body-text' },
    ]),
    'left image with three bullets - Fast - Private - Local',
  );
  const grid = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([
      { description: 'One', id: 'grid-1', placementHint: 'grid image 1', type: 'add-placeholder-image' },
      { description: 'Two', id: 'grid-2', placementHint: 'grid image 2', type: 'add-placeholder-image' },
      { id: 'grid-title', placementHint: '', text: 'Grid', type: 'add-title' },
      { id: 'caption-1', placementHint: '', text: 'First', type: 'add-body-text' },
      { id: 'caption-2', placementHint: '', text: 'Second', type: 'add-body-text' },
    ]),
    'two-image grid with matching captions',
  );
  const hero = createSlideDocument([
    { description: 'Hero', id: 'hero-media', placementHint: 'left media block', type: 'add-placeholder-image' },
    { id: 'hero-title', placementHint: 'right text block', text: 'Hero', type: 'add-title' },
    { id: 'hero-subtitle', placementHint: 'right text block', text: 'Subtitle', type: 'add-subtitle' },
  ]);

  const layoutSamples = [
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('title'), {
      allTasks: titleOnly.tasks,
      page: titleOnly.page,
      task: titleOnly.tasks.find((task) => task.type === 'add-title') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('center-title'), {
      allTasks: centered.tasks,
      page: centered.page,
      task: centered.tasks.find((task) => task.type === 'add-title') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('bullet-title'), {
      allTasks: bullets.tasks,
      page: bullets.page,
      task: bullets.tasks.find((task) => task.type === 'add-title') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createImageElement('grid-1'), {
      allTasks: grid.tasks,
      page: grid.page,
      task: grid.tasks.find((task) => task.type === 'add-placeholder-image') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createImageElement('hero-media'), {
      allTasks: hero.tasks as never,
      page: hero.page,
      task: hero.tasks[0] as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('hero-title'), {
      allTasks: hero.tasks as never,
      page: hero.page,
      task: hero.tasks[1] as never,
    }),
  ];

  const project = {
    assets: {
      image: {
        id: 'image',
        mimeType: 'image/png',
        name: 'Image',
        objectUrl: 'https://cdn.localstudio.test/image.png',
        type: 'image',
      },
    },
    createdAt: '2026-07-20T00:00:00.000Z',
    elements: {
      hidden: { ...createTextElement('hidden', 'Hidden'), visible: false },
      image: {
        assetId: 'image',
        height: 240,
        id: 'image',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 360,
        x: 120,
        y: 160,
      },
      shape: {
        fill: '#37FD76',
        height: 200,
        id: 'shape',
        locked: false,
        opacity: 1,
        rotation: 0,
        shape: 'ellipse',
        stroke: '#111827',
        strokeWidth: 2,
        type: 'shape',
        visible: true,
        width: 200,
        x: 620,
        y: 300,
      },
      title: {
        ...createTextElement('title', 'Remote preview'),
        fontFamily: 'Inter',
        fontWeight: 700,
        lineHeight: 1.1,
        locked: false,
        verticalAlign: 'middle',
        visible: true,
      },
    },
    id: 'remote-state-project',
    name: 'Remote State Project',
    pages: [
      {
        animationBuilds: [
          { delayMs: 0, durationMs: 300, effect: 'fade', elementId: 'title', id: 'build-1', kind: 'build-in', trigger: 'on-click' },
          { delayMs: 0, durationMs: 300, effect: 'wipe', elementId: 'shape', id: 'build-2', kind: 'build-out', trigger: 'after-previous' },
        ],
        background: { color: '#020617', type: 'color' },
        elementIds: ['title', 'image', 'shape', 'hidden'],
        height: 1080,
        id: 'slide-1',
        name: 'Opening',
        speakerNotes: 'Talk track',
        width: 1920,
      },
      {
        background: { assetId: 'image', colorFallback: '#111827', type: 'asset' },
        elementIds: ['shape'],
        height: 1080,
        id: 'slide-2',
        name: 'Next',
        speakerNotes: '',
        width: 1920,
      },
      {
        background: { color: '#111827', type: 'color' },
        elementIds: [],
        height: 1080,
        id: 'slide-3',
        name: 'Hidden',
        speakerNotes: '',
        visible: false,
        width: 1920,
      },
    ],
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
  const presenterPayload = {
    activePageId: 'slide-1',
    animationPreview: {
      hiddenElementIds: ['title'],
      mode: 'presenter',
      pageId: 'slide-1',
      phase: 'active',
      playing: true,
    },
    presenterMode: 'presenting',
    project,
    streamPeerId: 'stream-peer',
  };
  const remoteSkeleton = presenterRemoteStateFactory.createRemoteStateSkeleton(
    presenterPayload as never,
    2,
    { elapsedMs: 2_500, paused: false, updatedAtEpochMs: 1_786_000_000_000 },
  );
  const remoteState = await presenterRemoteStateFactory.createRemoteState(
    presenterPayload as never,
    2,
    { elapsedMs: 2_500, paused: false, updatedAtEpochMs: 1_786_000_000_000 },
  );
  const previewBatches = await presenterRemoteStateFactory.createRemotePreviewBatches(
    presenterPayload as never,
    ['slide-1', 'slide-2', 'slide-3', 'missing', 'extra', 'ignored'],
    'request-1',
  );
  const emptyRemoteState = await presenterRemoteStateFactory.createRemoteState(
    {
      activePageId: 'missing',
      project: { ...project, pages: [] },
    } as never,
    0,
    { elapsedMs: 0, paused: true },
  );
  const completeRemoteState = await presenterRemoteStateFactory.createRemoteState(
    {
      ...presenterPayload,
      animationPreview: {
        hiddenElementIds: [],
        mode: 'presenter',
        pageId: 'slide-1',
        phase: 'complete',
        playing: false,
      },
    } as never,
    1,
    { elapsedMs: 5_000, paused: false },
  );
  const idleRemoteSkeleton = presenterRemoteStateFactory.createRemoteStateSkeleton(
    {
      ...presenterPayload,
      animationPreview: undefined,
    } as never,
    0,
    { elapsedMs: 0, paused: true },
  );
  const largePreviewProject = {
    ...project,
    elements: {
      ...project.elements,
      huge: {
        ...createTextElement('huge', 'Preview '.repeat(5_000)),
        visible: true,
      },
    },
    pages: [
      {
        background: { color: '#020617', type: 'color' },
        elementIds: ['huge'],
        height: 1080,
        id: 'huge-slide',
        name: 'Huge',
        speakerNotes: '',
        width: 1920,
      },
      ...project.pages,
    ],
  };
  const splitPreviewBatches = await presenterRemoteStateFactory.createRemotePreviewBatches(
    {
      activePageId: 'huge-slide',
      project: largePreviewProject,
    } as never,
    ['huge-slide', 'slide-1', 'slide-2'],
    'split-request',
  );
  const restoredHeroProject = editorViewModelProject.normalizeProjectDocument({
    ...project,
    assets: {
      ...project.assets,
      'asset-hero': {
        id: 'asset-hero',
        mimeType: 'image/png',
        name: 'Legacy hero',
        objectUrl: undefined,
        type: 'image',
      },
    },
    elements: {
      ...project.elements,
      'legacy-hidden': {
        ...createTextElement('legacy-hidden', 'Legacy hidden'),
        visible: undefined,
      },
    },
    pages: [
      {
        ...project.pages[0],
        animationBuilds: undefined,
        elementIds: ['legacy-hidden'],
        visible: undefined,
      },
      ...project.pages.slice(1),
    ],
  } as never);

  const speechUpdates: Array<{ final: boolean; text: string }> = [];
  const speechErrors: string[] = [];
  class FakeSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    maxAlternatives = 0;
    onend: (() => void) | null = null;
    onerror: ((event: { error?: string; message?: string }) => void) | null = null;
    onresult:
      | ((
          event: {
            resultIndex: number;
            results: ArrayLike<{ 0?: { transcript?: string }; isFinal: boolean }>;
          },
        ) => void)
      | null = null;
    starts = 0;
    stopThrows = false;

    abort() {
      window.setTimeout(() => this.onend?.(), 0);
    }

    start() {
      this.starts += 1;
    }

    stop() {
      if (this.stopThrows) throw new Error('stop failed');
      window.setTimeout(() => this.onend?.(), 0);
    }

    emit(results: Array<{ final: boolean; text?: string }>, resultIndex = 0) {
      this.onresult?.({
        resultIndex,
        results: results.map((result) => ({
          0: { transcript: result.text },
          isFinal: result.final,
        })),
      });
    }
  }
  let activeSpeechRecognition: FakeSpeechRecognition | undefined;
  const SpeechRecognitionConstructor = class extends FakeSpeechRecognition {
    constructor() {
      super();
      activeSpeechRecognition = this;
    }
  };
  const speechTranscriber = new PresenterSpeechTranscriber({
    onError: (message) => speechErrors.push(message),
    onTranscript: (update) => speechUpdates.push(update),
    recognitionConstructor: SpeechRecognitionConstructor,
  });
  speechTranscriber.start('pt-BR');
  activeSpeechRecognition?.emit([{ final: false, text: '  ola   mundo ' }]);
  activeSpeechRecognition?.emit([{ final: true, text: 'ola mundo' }]);
  activeSpeechRecognition?.emit([{ final: true, text: 'ola mundo' }]);
  activeSpeechRecognition?.emit([{ final: false, text: '' }]);
  activeSpeechRecognition?.onerror?.({ error: 'no-speech' });
  activeSpeechRecognition?.onerror?.({ error: 'not-allowed' });
  activeSpeechRecognition?.onerror?.({ error: 'network', message: 'Network down' });
  await speechTranscriber.setLanguage('pt-BR');
  await speechTranscriber.setLanguage('en-US');
  const changedSpeechLanguage = activeSpeechRecognition?.lang;
  await speechTranscriber.stop();
  const unsupportedSpeechMessage = (() => {
    try {
      new PresenterSpeechTranscriber({
        onTranscript: () => undefined,
        recognitionConstructor: undefined,
      }).start('en-US');
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return '';
  })();

  const recorderEvents: Array<{ durationMs: number; size: number }> = [];
  const stoppedTracks: string[] = [];
  class FakeTrack {
    stop() {
      stoppedTracks.push('stopped');
    }
  }
  class FakeMediaRecorder extends EventTarget {
    static isTypeSupported(mimeType: string) {
      return mimeType === 'audio/webm';
    }

    mimeType = 'audio/webm';
    state: RecordingState = 'inactive';
    requestCount = 0;

    pause() {
      this.state = 'paused';
    }

    requestData() {
      this.requestCount += 1;
      this.dispatchEvent(
        new BlobEvent('dataavailable', {
          data: new Blob([`chunk-${this.requestCount}`], { type: this.mimeType }),
        }),
      );
    }

    resume() {
      this.state = 'recording';
    }

    start() {
      this.state = 'recording';
      this.requestData();
    }

    stop() {
      this.state = 'inactive';
      this.dispatchEvent(
        new BlobEvent('dataavailable', {
          data: new Blob(['final'], { type: this.mimeType }),
        }),
      );
      window.setTimeout(() => this.dispatchEvent(new Event('stop')), 0);
    }
  }
  const originalMediaRecorder = window.MediaRecorder;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const revokedUrls: string[] = [];
  (window as Window & { MediaRecorder: typeof MediaRecorder }).MediaRecorder =
    FakeMediaRecorder as unknown as typeof MediaRecorder;
  URL.createObjectURL = () => 'blob:contract-audio';
  URL.revokeObjectURL = (url) => revokedUrls.push(url);
  const fakeRecorder = new PresenterAudioRecorder({
    getUserMedia: async () =>
      ({
        getTracks: () => [new FakeTrack()],
      }) as unknown as MediaStream,
    mediaRecorderFactory: (_stream, options) => new FakeMediaRecorder() as unknown as MediaRecorder,
    onChunk: (chunk) => recorderEvents.push({ durationMs: chunk.durationMs, size: chunk.blob.size }),
    timesliceMs: 1,
  });
  await fakeRecorder.start();
  const recordingBeforePause = fakeRecorder.isRecording();
  fakeRecorder.pause();
  fakeRecorder.resume();
  const recorderResult = await fakeRecorder.stop();
  const objectUrl = fakeRecorder.getObjectUrl();
  fakeRecorder.revokeObjectUrl();
  const stopBeforeStartMessage = await new PresenterAudioRecorder()
    .stop()
    .then(() => '', (error: unknown) => (error instanceof Error ? error.message : String(error)));
  (window as Window & { MediaRecorder: typeof MediaRecorder }).MediaRecorder = originalMediaRecorder;
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;

  const postedPresenterCommands: unknown[] = [];
  let remoteOnCommand: ((command: never) => void) | undefined;
  const remoteHostStates: unknown[] = [];
  const remoteHostPreviews: unknown[] = [];
  const remoteCommands: unknown[] = [];
  const fakeTargetWindow = {
    addEventListener: (_type: string, handler: EventListener) => {
      (fakeTargetWindow as { handler?: EventListener }).handler = handler;
    },
    dispatchMessage: (data: unknown, origin = 'http://localhost') => {
      (fakeTargetWindow as { handler?: EventListener }).handler?.(
        new MessageEvent('message', { data, origin }),
      );
    },
    localStorage: {
      getItem: () => undefined,
      setItem: () => undefined,
    },
    location: { href: 'http://localhost/editor/?newProject=1' },
    open: () => null,
    removeEventListener: () => undefined,
  } as unknown as Window & { dispatchMessage(data: unknown, origin?: string): void };
  const sessionService = new BrowserPresenterSessionService({
    href: 'http://localhost/editor/?newProject=1',
    presenterDeviceId: 'presenter-device',
    randomId: () => 'session-contract',
    remotePeerControlHostFactory: (options) => {
      remoteOnCommand = options.onCommand as (command: never) => void;
      remoteCommands.push(options.presenterDeviceId);
      return {
        close: () => remoteCommands.push('closed'),
        open: async () => ({
          connectedControllerCount: 1,
          controlPeerId: 'peer-contract',
          expiresAt: Date.now() + 60_000,
          presenterDeviceId: 'presenter-device',
          presenterLabel: 'Contract deck',
          startedAt: Date.now(),
        }),
        publishPreviewBatch: (batch) => remoteHostPreviews.push(batch),
        publishState: (state) => remoteHostStates.push(state),
      };
    },
    targetWindow: fakeTargetWindow,
  });
  const blockedWindow = sessionService.openPresenterWindow();
  sessionService.subscribeToCommands((command) => postedPresenterCommands.push(command));
  await sessionService.openRemoteControlSession({
    presenterDeviceId: 'presenter-device',
    presenterLabel: 'Contract deck',
    ttlMs: 60_000,
  });
  sessionService.publishState(presenterPayload as never);
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  fakeTargetWindow.dispatchMessage({
    command: 'next',
    sessionId: blockedWindow.sessionId,
    source: 'localstudio-presenter-window',
    type: 'command',
  });
  remoteOnCommand?.({
    command: 'request-previews',
    pageIds: ['slide-1'],
    requestId: 'preview-contract',
  } as never);
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  sessionService.closePresenterWindow();

  return {
    detectedLanguages,
    generatedTexts,
    layoutFills: layoutSamples.map((sample) => ('fill' in sample ? sample.fill : undefined)),
    parsingErrors,
    patchedWarningCodes: patchedPptx.warnings.map((warning) => warning.code).sort(),
    progress: {
      estimated: progress.estimateRemainingMs({ elapsedMs: 500, loadedBytes: 25, totalBytes: 100 }),
      invalidEstimate:
        progress.estimateRemainingMs({ elapsedMs: 0, loadedBytes: 0, totalBytes: 100 }) ?? null,
      mapped: progress.mapProgressToRange(50, 20, 60),
      reported: reportedProgress.map((entry) => entry.value),
      tickerValues,
    },
    remote: {
      activePageName: remoteState.activePageName,
      batchCount: previewBatches.length,
      completeRemaining: completeRemoteState.buildsRemaining,
      emptyPageCount: emptyRemoteState.pageCount,
      idleRemaining: idleRemoteSkeleton.buildsRemaining,
      restoredHeroFirstElement: restoredHeroProject.pages[0]?.elementIds[0],
      restoredHeroVisible: restoredHeroProject.elements['image-hero']?.visible,
      skeletonRemaining: remoteSkeleton.buildsRemaining,
      slidePreviewElements: remoteState.slidePreview?.elements.length ?? 0,
      splitBatchCount: splitPreviewBatches.length,
      timerValid: presenterRemoteStateFactory.isPresenterRemoteTimerState(remoteState.timer),
      timerInvalid: presenterRemoteStateFactory.isPresenterRemoteTimerState({ elapsedMs: 'bad', paused: false }),
      upcomingCount: remoteState.upcomingSlidePreviews.length,
    },
    recorder: {
      chunkCount: recorderEvents.length,
      objectUrl,
      recordingBeforePause,
      revokedUrls,
      stopBeforeStartMessage,
      stoppedTracks: stoppedTracks.length,
      type: recorderResult.mimeType,
    },
    session: {
      blockedStatus: blockedWindow.status,
      postedCommands: postedPresenterCommands.length,
      previewCount: remoteHostPreviews.length,
      remoteClosed: remoteCommands.includes('closed'),
      stateCount: remoteHostStates.length,
    },
    speech: {
      changedSpeechLanguage,
      errors: speechErrors,
      text: speechTranscriber.getText(),
      unsupportedSpeechMessage,
      updates: speechUpdates,
    },
  };
}
