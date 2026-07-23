export type PresenterRemotePreviewContractResult = {
  backgroundImage: string | undefined;
  edgeBatchCount: number;
  edgeStatePageCount: number;
  elementKinds: string[];
  mediaUrls: Array<string | undefined>;
  previewBatchCount: number;
  timerGuardResults: boolean[];
  warningCount: number;
};

export async function evaluatePresenterRemotePreviewContract(): Promise<PresenterRemotePreviewContractResult> {
  const { presenterRemoteStateFactory } = (await import(
    '/editor/src/services/presenter/presenterRemoteStateFactory.ts'
  )) as typeof import('../../../apps/editor/src/services/presenter/presenterRemoteStateFactory');
  const diagnosticsWindow = window as Window & {
    __LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__?: boolean;
  };
  const originalFlag = diagnosticsWindow.__LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__;
  const originalCreateElement = document.createElement.bind(document);
  const OriginalImage = window.Image;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  const originalWarn = console.warn;
  let videoMode: 'error' | 'metadata-throws' | 'success' | 'zero-size' = 'success';
  let warningCount = 0;

  diagnosticsWindow.__LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__ = true;
  window.Image = class DiagnosticImage {
    height = 180;
    naturalHeight = 180;
    naturalWidth = 320;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    width = 320;

    set src(value: string) {
      window.setTimeout(() => {
        if (value.includes('preview-image-error')) {
          this.onerror?.();
          return;
        }
        if (value.includes('preview-image-zero')) {
          this.naturalHeight = 0;
          this.naturalWidth = 0;
        }
        this.onload?.();
      }, 0);
    }
  } as unknown as typeof Image;
  console.warn = (...args: unknown[]) => {
    warningCount += 1;
    originalWarn(...args);
  };
  CanvasRenderingContext2D.prototype.drawImage = function drawImage() {
    return undefined;
  };
  document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() !== 'video') return originalCreateElement(tagName, options);
    let currentTime = 0;
    const video = {
      crossOrigin: '',
      duration: 4,
      error: null,
      load() {
        window.setTimeout(() => {
          if (videoMode === 'error') {
            video.onerror?.(new Event('error'));
            return;
          }
          video.onloadedmetadata?.(new Event('loadedmetadata'));
          video.onloadeddata?.(new Event('loadeddata'));
        }, 0);
      },
      muted: false,
      onerror: null as ((event: Event) => void) | null,
      onloadeddata: null as ((event: Event) => void) | null,
      onloadedmetadata: null as ((event: Event) => void) | null,
      onseeked: null as ((event: Event) => void) | null,
      playsInline: false,
      preload: '',
      readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
      removeAttribute() {
        // The preview cleanup path should tolerate embedded media shims.
      },
      set currentTime(value: number) {
        if (videoMode === 'metadata-throws') throw new Error('seek unavailable');
        currentTime = value;
        window.setTimeout(() => video.onseeked?.(new Event('seeked')), 0);
      },
      get currentTime() {
        return currentTime;
      },
      set src(_value: string) {
        // The contract drives media readiness through load().
      },
      get videoHeight() {
        return videoMode === 'zero-size' ? 0 : 180;
      },
      get videoWidth() {
        return videoMode === 'zero-size' ? 0 : 320;
      },
    };
    return video as unknown as HTMLVideoElement;
  });

  function createOversizedDataImageUrl(marker: string) {
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><desc>${marker}</desc><text>${'x'.repeat(
        10_200,
      )}</text></svg>`,
    )}`;
  }

  function createPreviewProject({
    imageBlobUrl,
    mediaBlobUrl,
    oversizedDataImageUrl,
  }: {
    imageBlobUrl: string;
    mediaBlobUrl: string;
    oversizedDataImageUrl: string;
  }) {
    return {
      assets: {
        blobImage: {
          id: 'blobImage',
          mimeType: 'image/svg+xml',
          name: 'Blob image',
          objectUrl: imageBlobUrl,
          type: 'image',
        },
        genericData: {
          id: 'genericData',
          mimeType: 'application/octet-stream',
          name: 'Generic data',
          objectUrl: 'data:application/octet-stream;base64,SGVsbG8=',
          type: 'image',
        },
        gif: {
          id: 'gif',
          mimeType: 'image/gif',
          name: 'Gif',
          objectUrl: oversizedDataImageUrl,
          type: 'gif',
        },
        inlineGif: {
          id: 'inlineGif',
          mimeType: 'image/gif',
          name: 'Inline GIF',
          objectUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
          type: 'gif',
        },
        remoteVideo: {
          id: 'remoteVideo',
          mimeType: 'video/mp4',
          name: 'Remote video',
          objectUrl: 'https://cdn.localstudio.test/video.mp4',
          type: 'video',
        },
        video: {
          id: 'video',
          mimeType: 'video/mp4',
          name: 'Video',
          objectUrl: mediaBlobUrl,
          type: 'video',
        },
      },
      createdAt: '2026-07-22T00:00:00.000Z',
      elements: {
        blobImage: {
          assetId: 'blobImage',
          height: 90,
          id: 'blobImage',
          locked: false,
          opacity: 1,
          rotation: 0,
          type: 'image',
          visible: true,
          width: 120,
          x: 0,
          y: 0,
        },
        genericData: {
          assetId: 'genericData',
          height: 90,
          id: 'genericData',
          locked: false,
          opacity: 1,
          rotation: 0,
          type: 'image',
          visible: true,
          width: 120,
          x: 0,
          y: 100,
        },
        gif: {
          assetId: 'gif',
          height: 90,
          id: 'gif',
          locked: false,
          opacity: 1,
          playing: true,
          rotation: 0,
          type: 'gif',
          visible: true,
          width: 120,
          x: 130,
          y: 0,
        },
        inlineGif: {
          assetId: 'inlineGif',
          height: 90,
          id: 'inlineGif',
          locked: false,
          opacity: 1,
          playing: true,
          rotation: 0,
          type: 'gif',
          visible: true,
          width: 120,
          x: 130,
          y: 100,
        },
        missingImage: {
          assetId: 'missingAsset',
          height: 90,
          id: 'missingImage',
          locked: false,
          opacity: 1,
          rotation: 0,
          type: 'image',
          visible: true,
          width: 120,
          x: 520,
          y: 0,
        },
        remoteVideo: {
          assetId: 'remoteVideo',
          autoplayInPreview: true,
          controls: false,
          durationSeconds: 4,
          height: 90,
          id: 'remoteVideo',
          locked: false,
          loop: true,
          muted: true,
          opacity: 1,
          playbackPositionSeconds: 0,
          playing: true,
          repeatMode: 'loop',
          rotation: 0,
          trimStartSeconds: 0,
          type: 'video',
          visible: true,
          width: 120,
          x: 390,
          y: 0,
        },
        shape: {
          fill: '#f97316',
          height: 90,
          id: 'shape',
          locked: false,
          opacity: 0.75,
          rotation: 8,
          shape: 'rounded-rectangle',
          stroke: '#111827',
          strokeWidth: 2,
          type: 'shape',
          visible: true,
          width: 120,
          x: 0,
          y: 210,
        },
        text: {
          align: 'center',
          fill: '#111827',
          fontFamily: 'Inter',
          fontSize: 34,
          fontWeight: 700,
          height: 80,
          hyperlink: 'https://localstudio.dev',
          id: 'text',
          lineHeight: 1.2,
          locked: false,
          opacity: 1,
          rotation: 0,
          text: 'Remote preview',
          type: 'text',
          verticalAlign: 'middle',
          visible: true,
          width: 320,
          x: 0,
          y: 310,
        },
        video: {
          assetId: 'video',
          autoplayInPreview: false,
          controls: true,
          durationSeconds: 4,
          height: 90,
          id: 'video',
          locked: false,
          loop: false,
          muted: false,
          opacity: 1,
          playbackPositionSeconds: 0,
          playing: false,
          posterFrameSeconds: Number.POSITIVE_INFINITY,
          repeatMode: 'none',
          rotation: 0,
          trimStartSeconds: 1,
          type: 'video',
          visible: true,
          width: 120,
          x: 260,
          y: 0,
        },
        visibleFalse: {
          assetId: 'blobImage',
          height: 90,
          id: 'visibleFalse',
          locked: false,
          opacity: 1,
          rotation: 0,
          type: 'image',
          visible: false,
          width: 120,
          x: 660,
          y: 0,
        },
      },
      id: 'presenter-preview-contract',
      name: 'Presenter Preview Contract',
      pages: [
        {
          animationBuilds: [
            { elementId: 'blobImage', id: 'build-1', order: 0, type: 'appear' },
            { elementId: 'missing-build-target', id: 'build-missing', order: 1, type: 'appear' },
          ],
          background: { assetId: 'blobImage', colorFallback: '#000000', type: 'asset' },
          elementIds: [
            'blobImage',
            'gif',
            'inlineGif',
            'video',
            'remoteVideo',
            'missingImage',
            'visibleFalse',
            'missingElement',
            'genericData',
            'shape',
            'text',
          ],
          height: 720,
          id: 'slide-1',
          name: 'Media',
          speakerNotes: '',
          width: 1280,
        },
        {
          background: { color: '#123456', type: 'color' },
          elementIds: ['text'],
          height: 720,
          id: 'slide-2',
          name: 'Details',
          speakerNotes: 'Second slide notes',
          width: 1280,
        },
        {
          background: { color: '#654321', type: 'color' },
          elementIds: ['shape'],
          height: 720,
          id: 'slide-3',
          name: 'Third',
          speakerNotes: '',
          width: 1280,
        },
      ],
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
  }

  try {
    const imageBlobUrl = URL.createObjectURL(
      new Blob(
        [
          '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#37FD76"/></svg>',
        ],
        { type: 'image/svg+xml' },
      ),
    );
    const mediaBlobUrl = URL.createObjectURL(new Blob(['video'], { type: 'video/mp4' }));
    const project = createPreviewProject({
      imageBlobUrl,
      mediaBlobUrl,
      oversizedDataImageUrl: createOversizedDataImageUrl('preview-image-success'),
    });
    const state = await presenterRemoteStateFactory.createRemoteState(
      { activePageId: 'slide-1', project } as never,
      1,
      { elapsedMs: 0, paused: false },
    );
    const batches = await presenterRemoteStateFactory.createRemotePreviewBatches(
      { activePageId: 'slide-1', project } as never,
      ['slide-1', 'slide-2', 'slide-3', 'slide-4', 'slide-5', 'slide-6'],
      'preview-contract',
    );

    await presenterRemoteStateFactory.createRemoteState(
      {
        activePageId: 'slide-1',
        animationPreview: {
          hiddenElementIds: ['blobImage'],
          pageId: 'slide-1',
          phase: 'active',
        },
        project,
      } as never,
      2,
      { elapsedMs: 250, paused: true },
    );

    videoMode = 'error';
    await presenterRemoteStateFactory.createRemotePreviewBatches(
      { activePageId: 'slide-1', project } as never,
      ['slide-1'],
      'video-error',
    );
    videoMode = 'zero-size';
    await presenterRemoteStateFactory.createRemotePreviewBatches(
      { activePageId: 'slide-1', project } as never,
      ['slide-1'],
      'video-zero',
    );
    videoMode = 'metadata-throws';
    await presenterRemoteStateFactory.createRemotePreviewBatches(
      { activePageId: 'slide-1', project } as never,
      ['slide-1'],
      'video-seek-fallback',
    );
    videoMode = 'success';

    const edgeProject = createPreviewProject({
      imageBlobUrl: createOversizedDataImageUrl('preview-image-error'),
      mediaBlobUrl,
      oversizedDataImageUrl: createOversizedDataImageUrl('preview-image-zero'),
    });
    edgeProject.pages[0].hidden = true;
    const edgeState = presenterRemoteStateFactory.createRemoteStateSkeleton(
      { activePageId: 'missing-slide', project: edgeProject } as never,
      0,
      { elapsedMs: 0, paused: false },
    );
    const edgeBatches = await presenterRemoteStateFactory.createRemotePreviewBatches(
      { activePageId: 'missing-slide', project: edgeProject } as never,
      ['slide-1', 'slide-2'],
      undefined,
    );

    URL.revokeObjectURL(imageBlobUrl);
    URL.revokeObjectURL(mediaBlobUrl);
    const mediaUrls: Array<string | undefined> = [];
    for (const element of state.slidePreview?.elements ?? []) {
      if ((element.kind === 'media' || element.kind === 'image') && 'assetUrl' in element) {
        mediaUrls.push(element.assetUrl);
      }
    }
    return {
      backgroundImage: state.slidePreview?.backgroundImageUrl,
      edgeBatchCount: edgeBatches.length,
      edgeStatePageCount: edgeState.pageCount,
      elementKinds: state.slidePreview?.elements.map((element) => element.kind) ?? [],
      mediaUrls,
      previewBatchCount: batches.length,
      timerGuardResults: [
        presenterRemoteStateFactory.isPresenterRemoteTimerState({
          elapsedMs: 1,
          paused: false,
          updatedAtEpochMs: 1,
        }),
        presenterRemoteStateFactory.isPresenterRemoteTimerState({ elapsedMs: 1, paused: false }),
        presenterRemoteStateFactory.isPresenterRemoteTimerState({ elapsedMs: '1', paused: false }),
        presenterRemoteStateFactory.isPresenterRemoteTimerState(null),
      ],
      warningCount,
    };
  } finally {
    CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    console.warn = originalWarn;
    document.createElement = originalCreateElement;
    window.Image = OriginalImage;
    if (originalFlag === undefined) {
      delete diagnosticsWindow.__LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__;
    } else {
      diagnosticsWindow.__LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__ = originalFlag;
    }
  }
}
