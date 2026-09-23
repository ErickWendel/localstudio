import type { WebMcpModelContext } from '../../../services/webmcp/webMcpToolAdapter';
import { assetFileUtils } from '../../../services/storage/assetFileUtils';
import type { SlideClipboardState } from '../state/editorViewModelElements';

const EDITOR_OBJECT_CLIPBOARD_TYPE = 'application/x-localstudio-editor-elements';
const EDITOR_OBJECT_CLIPBOARD_MARKER = '1';
const MAX_EDITOR_OBJECT_CLIPBOARD_BYTES = 1024 * 1024;
const MAX_SLIDE_CLIPBOARD_BYTES = 16 * 1024 * 1024;
const SLIDE_CLIPBOARD_PREFIX = 'LocalStudio.dev slide: ';

function isEditableElement(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isEditableInteractionTarget(target: EventTarget | null) {
  return isEditableElement(target) || isEditableElement(document.activeElement);
}

function hasBrowserTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && selection.toString().length > 0);
}

function getClipboardImageFile(clipboardData: DataTransfer | null) {
  if (!clipboardData) return undefined;

  const fileFromFiles = Array.from(clipboardData.files).find((file) => file.type.startsWith('image/'));
  if (fileFromFiles) return fileFromFiles;

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return undefined;
}

function hasEditorObjectClipboardMarker(clipboardData: DataTransfer | null) {
  if (!clipboardData) return false;
  if (clipboardData.types && Array.from(clipboardData.types).includes(EDITOR_OBJECT_CLIPBOARD_TYPE)) {
    return true;
  }
  return clipboardData.getData?.(EDITOR_OBJECT_CLIPBOARD_TYPE) === EDITOR_OBJECT_CLIPBOARD_MARKER;
}

function writeEditorObjectClipboardMarker(clipboardData: DataTransfer | null) {
  if (!clipboardData) return;
  clipboardData.setData(EDITOR_OBJECT_CLIPBOARD_TYPE, EDITOR_OBJECT_CLIPBOARD_MARKER);
  clipboardData.setData('text/plain', 'LocalStudio.dev editor elements');
}

function writeEditorObjectClipboardPayload(clipboardData: DataTransfer | null, payload: string) {
  if (!clipboardData || payload.length > MAX_EDITOR_OBJECT_CLIPBOARD_BYTES) return;
  clipboardData.setData(EDITOR_OBJECT_CLIPBOARD_TYPE, payload);
  clipboardData.setData('text/plain', 'LocalStudio.dev editor elements');
}

function readEditorObjectClipboardPayload(clipboardData: DataTransfer | null) {
  if (!clipboardData) return undefined;
  const payload = clipboardData.getData?.(EDITOR_OBJECT_CLIPBOARD_TYPE);
  if (!payload || payload === EDITOR_OBJECT_CLIPBOARD_MARKER) return undefined;
  if (payload.length > MAX_EDITOR_OBJECT_CLIPBOARD_BYTES) return undefined;
  return payload;
}

async function resolveSlideClipboardPayload(payload: string | Promise<string>) {
  const resolvedPayload = await payload;
  if (resolvedPayload.length > MAX_SLIDE_CLIPBOARD_BYTES) {
    throw new Error('Slide clipboard payload exceeds the supported size.');
  }
  return `${SLIDE_CLIPBOARD_PREFIX}${resolvedPayload}`;
}

async function writeSlideClipboardPayload(payload: string | Promise<string>) {
  if (!navigator.clipboard) return false;
  try {
    if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
      const clipboardText = resolveSlideClipboardPayload(payload);
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': clipboardText.then(
            (text) => new Blob([text], { type: 'text/plain' }),
          ),
        }),
      ]);
      return true;
    }
    if (!navigator.clipboard.writeText) return false;
    await navigator.clipboard.writeText(await resolveSlideClipboardPayload(payload));
    return true;
  } catch {
    return false;
  }
}

function omitOversizedClipboardMedia(payload: SlideClipboardState): SlideClipboardState {
  const assets = Object.fromEntries(
    Object.entries(payload.assets).map(([assetId, asset]) => {
      const objectUrl = asset.objectUrl ?? '';
      const keepReference =
        objectUrl.startsWith('blob:') ||
        (objectUrl.length < 2048 && !objectUrl.startsWith('data:'));
      if (keepReference) return [assetId, asset] as const;
      return [assetId, { ...asset, objectUrl: '' }] as const;
    }),
  );
  return { ...payload, assets };
}

async function makeSlideClipboardPayloadTransferable(
  payload: SlideClipboardState,
  requestFetch: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  let nextPayload = payload;
  let omittedMedia = false;
  for (const [assetId, asset] of Object.entries(payload.assets)) {
    if (!assetFileUtils.isBlobUrl(asset.objectUrl)) continue;
    try {
      const blob = await assetFileUtils.objectUrlToBlob(asset.objectUrl, requestFetch);
      const dataUrl = await assetFileUtils.blobToDataUrl(blob);
      const candidate = {
        ...nextPayload,
        assets: {
          ...nextPayload.assets,
          [assetId]: { ...asset, objectUrl: dataUrl },
        },
      };
      if (JSON.stringify(candidate).length > MAX_SLIDE_CLIPBOARD_BYTES) {
        omittedMedia = true;
        continue;
      }
      nextPayload = candidate;
    } catch {
      // Keep the original object URL so a same-session paste can still resolve it.
    }
  }

  if (JSON.stringify(nextPayload).length > MAX_SLIDE_CLIPBOARD_BYTES) {
    omittedMedia = true;
    nextPayload = omitOversizedClipboardMedia(nextPayload);
  }

  return { omittedMedia, payload: nextPayload };
}

async function copySlideToClipboard(
  payload: SlideClipboardState,
  requestFetch: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  const prepared = await makeSlideClipboardPayloadTransferable(payload, requestFetch);
  const wrote = await writeSlideClipboardPayload(JSON.stringify(prepared.payload));
  if (!wrote) return prepared.omittedMedia ? 'copied-without-media' : 'unavailable';
  return prepared.omittedMedia ? 'copied-without-media' : 'copied';
}

function readSlideClipboardPayload(clipboardData: DataTransfer | null) {
  const text = clipboardData?.getData?.('text/plain') ?? '';
  if (!text.startsWith(SLIDE_CLIPBOARD_PREFIX)) return undefined;
  const payload = text.slice(SLIDE_CLIPBOARD_PREFIX.length);
  return payload.length <= MAX_SLIDE_CLIPBOARD_BYTES ? payload : undefined;
}

function isWebMcpEnabled() {
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get('webmcp') === '1';
}

function isWebMcpProtocolEnabled() {
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get('webmcp') !== '0';
}

function getWebMcpModelContext() {
  if (typeof document === 'undefined') return undefined;
  return (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
}

export const editorShellBrowserUtils = {
  isEditableInteractionTarget,
  hasBrowserTextSelection,
  getClipboardImageFile,
  hasEditorObjectClipboardMarker,
  writeEditorObjectClipboardMarker,
  writeEditorObjectClipboardPayload,
  readEditorObjectClipboardPayload,
  writeSlideClipboardPayload,
  makeSlideClipboardPayloadTransferable,
  copySlideToClipboard,
  readSlideClipboardPayload,
  isWebMcpEnabled,
  isWebMcpProtocolEnabled,
  getWebMcpModelContext,
};
