import type { DesignElement, Page, ProjectDocument } from '../../domain/documents/model';
import { pageVisibility } from '../../domain/documents/pageVisibility';
import { presenterRemoteDebugLog } from '@localstudio/presenter-remote/debug-log';
import type {
  PresenterRemotePreviewBatch,
  PresenterRemoteSlidePreview,
  PresenterRemoteSlidePreviewElement,
  PresenterRemoteState,
  PresenterRemoteTimerState,
  PresenterRemoteUpcomingSlidePreview,
} from '@localstudio/presenter-remote/protocol';
import type { PresenterStatePayload } from './presenterSessionTypes';

const remotePreviewBatchMaxBytes = 10_000;
const remotePreviewMaxInlineAssetLength = 10_000;
const remotePreviewThumbnailMaxEdge = 96;
const remotePreviewThumbnailQuality = 0.32;

function isPresenterRemoteTimerState(value: unknown): value is PresenterRemoteTimerState {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.elapsedMs === 'number' &&
    typeof record.paused === 'boolean' &&
    (record.updatedAtEpochMs === undefined || typeof record.updatedAtEpochMs === 'number')
  );
}

function createRemoteStateSkeleton(
  payload: PresenterStatePayload,
  connectedControllerCount: number,
  timer: PresenterRemoteTimerState,
): PresenterRemoteState {
  const visiblePages = pageVisibility.getVisiblePages(payload.project);
  const activePage =
    pageVisibility.getNearestVisiblePage(payload.project, payload.activePageId) ??
    payload.project.pages[0];
  const activePageIndex = activePage
    ? Math.max(0, visiblePages.findIndex((page) => page.id === activePage.id))
    : 0;
  const nextPage = visiblePages[activePageIndex + 1];
  const activePageBuilds = activePage ? getRemoteBuildInfo(payload, activePage) : undefined;
  return {
    activePageId: activePage?.id ?? payload.activePageId,
    activePageIndex,
    activePageName: activePage?.name,
    builds: activePageBuilds?.total ? activePageBuilds : undefined,
    buildsRemaining: activePageBuilds?.remaining ?? 0,
    connectedControllerCount,
    deckName: payload.project.name,
    nextPageName: nextPage?.name,
    notes: activePage?.speakerNotes ?? '',
    pageCount: visiblePages.length,
    pages: visiblePages.map((page) => ({
      id: page.id,
      name: page.name,
    })),
    presenterMode: payload.presenterMode ?? 'presenting',
    commandAvailability: [
      'previous',
      'next',
      'go-to-page',
      'pause-timer',
      'resume-timer',
      'reset-timer',
      'play-pause-movie',
    ],
    previewMode: 'stream',
    shortcuts: ['previous', 'next', 'pause-timer', 'reset-timer'],
    stream: {
      enabled: true,
      fps: 8,
      height: 340,
      peerId: payload.streamPeerId,
      transport: 'peerjs',
      width: 390,
    },
    timer,
    type: 'state',
    upcomingSlidePreviews: [],
  };
}

function createRemoteState(
  payload: PresenterStatePayload,
  connectedControllerCount: number,
  timer: PresenterRemoteTimerState,
): Promise<PresenterRemoteState> {
  const visiblePages = pageVisibility.getVisiblePages(payload.project);
  const activePage =
    pageVisibility.getNearestVisiblePage(payload.project, payload.activePageId) ??
    payload.project.pages[0];
  const activePageIndex = activePage
    ? Math.max(0, visiblePages.findIndex((page) => page.id === activePage.id))
    : 0;
  const nextPage = visiblePages[activePageIndex + 1];
  const hiddenElementIds =
    activePage && payload.animationPreview?.pageId === activePage.id
      ? new Set(payload.animationPreview.hiddenElementIds)
      : undefined;
  const activePageBuilds = activePage ? getRemoteBuildInfo(payload, activePage) : undefined;
  const pages = visiblePages.map((page) => ({
    id: page.id,
    name: page.name,
  }));
  return Promise.all([
    activePage
      ? createSlidePreview(payload.project, activePage, hiddenElementIds)
      : Promise.resolve(undefined),
    createUpcomingSlidePreviews(
      payload.project,
      visiblePages.slice(activePageIndex + 1, activePageIndex + 4),
    ),
  ]).then(([slidePreview, upcomingSlidePreviews]) => ({
    activePageId: activePage?.id ?? payload.activePageId,
    activePageIndex,
    activePageName: activePage?.name,
    builds: activePageBuilds?.total ? activePageBuilds : undefined,
    buildsRemaining: activePageBuilds?.remaining ?? 0,
    connectedControllerCount,
    deckName: payload.project.name,
    nextPageName: nextPage?.name,
    nextSlidePreview: upcomingSlidePreviews[0]?.preview,
    notes: activePage?.speakerNotes ?? '',
    pageCount: visiblePages.length,
    pages,
    presenterMode: payload.presenterMode ?? 'presenting',
    commandAvailability: [
      'previous',
      'next',
      'go-to-page',
      'pause-timer',
      'resume-timer',
      'reset-timer',
      'play-pause-movie',
    ],
    previewMode: 'stream',
    shortcuts: ['previous', 'next', 'pause-timer', 'reset-timer'],
    slidePreview,
    stream: {
      enabled: true,
      fps: 8,
      height: 340,
      peerId: payload.streamPeerId,
      transport: 'peerjs',
      width: 390,
    },
    timer,
    type: 'state',
    upcomingSlidePreviews,
  }));
}

function getRemoteBuildInfo(payload: PresenterStatePayload, page: Page) {
  const validBuilds = (page.animationBuilds ?? []).filter((build) =>
    page.elementIds.includes(build.elementId),
  );
  if (validBuilds.length === 0) return { current: 0, remaining: 0, total: 0 };
  if (payload.animationPreview?.pageId !== page.id) {
    return { current: 1, remaining: validBuilds.length, total: validBuilds.length };
  }
  if (payload.animationPreview.phase === 'complete') {
    return { current: validBuilds.length, remaining: 0, total: validBuilds.length };
  }
  const hiddenElementIds = new Set(payload.animationPreview.hiddenElementIds);
  const remaining = validBuilds.filter((build) => hiddenElementIds.has(build.elementId)).length;
  return {
    current: Math.min(validBuilds.length, Math.max(1, validBuilds.length - remaining + 1)),
    remaining,
    total: validBuilds.length,
  };
}

function createUpcomingSlidePreviews(
  project: ProjectDocument,
  pages: Page[],
): Promise<PresenterRemoteUpcomingSlidePreview[]> {
  return Promise.all(
    pages.map((page) =>
      createSlidePreview(project, page).then((preview) => ({
        pageId: page.id,
        pageName: page.name,
        preview,
      })),
    ),
  );
}

async function createRemotePreviewBatches(
  payload: PresenterStatePayload,
  requestedPageIds: string[],
  requestId: string | undefined,
): Promise<PresenterRemotePreviewBatch[]> {
  const pageIds = new Set(requestedPageIds.slice(0, 5));
  const activePageIndex = Math.max(
    0,
    payload.project.pages.findIndex((page) => page.id === payload.activePageId),
  );
  const activePage = payload.project.pages[activePageIndex];
  const hiddenElementIds =
    activePage && payload.animationPreview?.pageId === activePage.id
      ? new Set(payload.animationPreview.hiddenElementIds)
      : undefined;
  const previews = await Promise.all(
    payload.project.pages
      .filter((page) => pageVisibility.isVisible(page) && pageIds.has(page.id))
      .map(async (page) => ({
        id: page.id,
        name: page.name,
        preview: await createSlidePreview(
          payload.project,
          page,
          page.id === activePage?.id ? hiddenElementIds : undefined,
        ),
      })),
  );
  return createPreviewBatches(previews, requestId);
}

function createPreviewBatches(
  previews: PresenterRemotePreviewBatch['previews'],
  requestId: string | undefined,
) {
  const batches: PresenterRemotePreviewBatch[] = [];
  let currentBatch: PresenterRemotePreviewBatch['previews'] = [];
  for (const preview of previews) {
    const candidateBatch = {
      previews: [...currentBatch, preview],
      requestId,
      type: 'preview-batch' as const,
    };
    if (currentBatch.length > 0 && getJsonByteLength(candidateBatch) > remotePreviewBatchMaxBytes) {
      batches.push({ previews: currentBatch, requestId, type: 'preview-batch' });
      currentBatch = [preview];
      continue;
    }
    currentBatch = candidateBatch.previews;
  }
  if (currentBatch.length > 0) {
    batches.push({ previews: currentBatch, requestId, type: 'preview-batch' });
  }
  return batches;
}

async function createSlidePreview(
  project: ProjectDocument,
  page: Page,
  hiddenElementIds = new Set<string>(),
): Promise<PresenterRemoteSlidePreview> {
  const backgroundAsset =
    page.background.type === 'asset' ? project.assets[page.background.assetId] : undefined;
  const elements: PresenterRemoteSlidePreviewElement[] = [];
  for (const elementId of page.elementIds) {
    if (hiddenElementIds.has(elementId)) continue;
    const element = project.elements[elementId];
    if (!element || element.visible === false) continue;
    elements.push(await createSlidePreviewElement(project, element));
  }
  return {
    backgroundColor:
      page.background.type === 'color' ? page.background.color : page.background.colorFallback,
    backgroundImageUrl: await createPreviewAssetUrl(backgroundAsset?.objectUrl),
    elements,
    height: page.height,
    width: page.width,
  };
}

function createElementFrame(element: DesignElement) {
  return {
    height: element.height,
    id: element.id,
    opacity: element.opacity,
    rotation: element.rotation,
    width: element.width,
    x: element.x,
    y: element.y,
  };
}

function createSlidePreviewElement(
  project: ProjectDocument,
  element: DesignElement,
): Promise<PresenterRemoteSlidePreviewElement> {
  const frame = createElementFrame(element);
  if (element.type === 'text') {
    return Promise.resolve({
      ...frame,
      align: element.align,
      fill: element.fill,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      hyperlink: element.hyperlink,
      kind: 'text',
      lineHeight: element.lineHeight,
      text: element.text,
      verticalAlign: element.verticalAlign,
    });
  }
  if (element.type === 'image') {
    return createPreviewAssetUrl(project.assets[element.assetId]?.objectUrl).then((assetUrl) => ({
      ...frame,
      assetUrl,
      kind: 'image',
    }));
  }
  if (element.type === 'gif' || element.type === 'video') {
    const asset = project.assets[element.assetId];
    const posterFrameSeconds =
      element.type === 'video'
        ? element.posterFrameSeconds ?? element.trimStartSeconds
        : undefined;
    return createPreviewMediaAssetUrl(asset?.objectUrl, element.type, posterFrameSeconds).then(
      (assetUrl) => ({
        ...frame,
        assetUrl,
        autoplay:
          element.type === 'gif' ? element.playing : element.autoplayInPreview || element.playing,
        controls: element.type === 'video' ? element.controls : false,
        kind: 'media',
        loop: element.type === 'gif' ? element.playing : element.loop,
        mediaType: element.type,
        muted: element.type === 'video' ? element.muted : true,
      }),
    );
  }
  return Promise.resolve({
    ...frame,
    fill: element.fill,
    kind: 'shape',
    shape: element.shape,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
  });
}

async function createPreviewAssetUrl(assetUrl: string | undefined) {
  if (!assetUrl) return undefined;
  if (
    isTestRuntime() &&
    !isRemotePreviewThumbnailDiagnosticsEnabled() &&
    (assetUrl.startsWith('blob:') || assetUrl.startsWith('data:'))
  ) {
    return undefined;
  }
  if (assetUrl.startsWith('data:image/')) {
    if (assetUrl.length <= remotePreviewMaxInlineAssetLength) return assetUrl;
    return createThumbnailDataUrl(assetUrl).catch(() => undefined);
  }
  if (assetUrl.startsWith('data:')) return undefined;
  if (assetUrl.startsWith('blob:')) {
    return createThumbnailDataUrl(assetUrl).catch(() => undefined);
  }
  return assetUrl;
}

async function createPreviewMediaAssetUrl(
  assetUrl: string | undefined,
  mediaType: 'gif' | 'video',
  posterFrameSeconds: number | undefined,
) {
  if (!assetUrl) return undefined;
  if (mediaType === 'gif') return createPreviewAssetUrl(assetUrl);
  if (
    isTestRuntime() &&
    !isRemotePreviewThumbnailDiagnosticsEnabled() &&
    /^https?:\/\//.test(assetUrl)
  ) {
    return undefined;
  }
  if (assetUrl.startsWith('data:image/')) return createPreviewAssetUrl(assetUrl);
  if (
    assetUrl.startsWith('data:') ||
    assetUrl.startsWith('blob:') ||
    /^https?:\/\//.test(assetUrl)
  ) {
    return createVideoThumbnailDataUrl(assetUrl, posterFrameSeconds).catch(() => undefined);
  }
  return undefined;
}

function createThumbnailDataUrl(assetUrl: string) {
  if (typeof document === 'undefined') return Promise.resolve(undefined);
  return new Promise<string | undefined>((resolve) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => resolve(undefined), 250);
    image.onload = () => {
      window.clearTimeout(timeoutId);
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) {
          resolve(undefined);
          return;
        }
        const scale = Math.min(
          1,
          remotePreviewThumbnailMaxEdge / Math.max(sourceWidth, sourceHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(undefined);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', remotePreviewThumbnailQuality));
      } catch (error) {
        presenterRemoteDebugLog.warn('Remote preview thumbnail generation failed.', error);
        resolve(undefined);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      presenterRemoteDebugLog.warn('Remote preview thumbnail image failed to load.');
      resolve(undefined);
    };
    image.src = assetUrl;
  });
}

function createVideoThumbnailDataUrl(assetUrl: string, posterFrameSeconds: number | undefined) {
  if (typeof document === 'undefined') return Promise.resolve(undefined);
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish(undefined);
    }, 1500);

    function cleanup() {
      window.clearTimeout(timeoutId);
      video.onerror = null;
      video.onloadeddata = null;
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        // Some test and embedded browser media implementations expose load() without implementing it.
      }
    }

    function finish(dataUrl: string | undefined) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(dataUrl);
    }

    function resolveWithFrame() {
      try {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (!sourceWidth || !sourceHeight) {
          finish(undefined);
          return;
        }
        const scale = Math.min(
          1,
          remotePreviewThumbnailMaxEdge / Math.max(sourceWidth, sourceHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          finish(undefined);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', remotePreviewThumbnailQuality));
      } catch (error) {
        presenterRemoteDebugLog.warn('Remote preview video thumbnail generation failed.', error);
        finish(undefined);
      }
    }

    function handleLoadedMetadata() {
      const targetTime = Math.max(0, posterFrameSeconds ?? 0);
      if (!Number.isFinite(targetTime) || Math.abs(video.currentTime - targetTime) < 0.05) {
        resolveWithFrame();
        return;
      }
      try {
        video.currentTime = Math.min(targetTime, video.duration || targetTime);
      } catch {
        resolveWithFrame();
      }
    }

    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.onloadedmetadata = handleLoadedMetadata;
    video.onseeked = resolveWithFrame;
    video.onloadeddata = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime === 0) {
        resolveWithFrame();
      }
    };
    video.onerror = () => {
      presenterRemoteDebugLog.warn('Remote preview video thumbnail failed to load.');
      finish(undefined);
    };
    video.src = assetUrl;
    video.load();
  });
}

function getJsonByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isTestRuntime() {
  return import.meta.env.MODE === 'test';
}

function isRemotePreviewThumbnailDiagnosticsEnabled() {
  return (
    typeof window !== 'undefined' &&
    (window as Window & { __LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__?: boolean })
      .__LOCALSTUDIO_REMOTE_PREVIEW_THUMBNAIL_DIAGNOSTICS__ === true
  );
}

export const presenterRemoteStateFactory = {
  createRemotePreviewBatches,
  createRemoteState,
  createRemoteStateSkeleton,
  isPresenterRemoteTimerState,
};
