import type { WebMcpModelContext } from '../../../services/webmcp/webMcpToolAdapter';
import { assetFileUtils } from '../../../services/storage/assetFileUtils';
import type { SlideClipboardState } from '../state/editorViewModelElements';
import { slideClipboardMedia } from './slideClipboardMedia';

const EDITOR_OBJECT_CLIPBOARD_TYPE = 'application/x-localstudio-editor-elements';
const EDITOR_OBJECT_CLIPBOARD_MARKER = '1';
const MAX_EDITOR_OBJECT_CLIPBOARD_BYTES = 1024 * 1024;
const MAX_SLIDE_CLIPBOARD_BYTES = 16 * 1024 * 1024;
const SLIDE_CLIPBOARD_PREFIX = 'LocalStudio.dev slide: ';
let pendingSlideClipboardText: string | undefined;

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

function slidePayloadFromClipboardText(text: string) {
  if (!text.startsWith(SLIDE_CLIPBOARD_PREFIX)) return undefined;
  const payload = text.slice(SLIDE_CLIPBOARD_PREFIX.length);
  return payload.length <= MAX_SLIDE_CLIPBOARD_BYTES ? payload : undefined;
}

function isImageClipboardType(type: string) {
  return type === 'Files' || type.startsWith('image/');
}

function textPrecedesImage(types: readonly string[]) {
  const textIndex = types.indexOf('text/plain');
  if (textIndex === -1) return false;
  const imageIndex = types.findIndex(isImageClipboardType);
  return imageIndex === -1 || textIndex < imageIndex;
}

function readPendingSlideClipboardText() {
  return pendingSlideClipboardText;
}

function writeSlideClipboardTextSynchronously(payload: string) {
  if (payload.length > MAX_SLIDE_CLIPBOARD_BYTES || typeof document === 'undefined') return false;
  const text = `${SLIDE_CLIPBOARD_PREFIX}${payload}`;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  pendingSlideClipboardText = text;
  document.body.append(textarea);
  try {
    textarea.focus();
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    pendingSlideClipboardText = undefined;
  }
}

async function writeSlideClipboardPayload(payload: string | Promise<string>) {
  if (!navigator.clipboard) return false;
  const clipboardText = resolveSlideClipboardPayload(payload);
  if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
    try {
      // text/plain is the only representation so it replaces a screenshot image
      // instead of remaining behind it in clipboard type order.
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': clipboardText.then(
            (text) => new Blob([text], { type: 'text/plain' }),
          ),
        }),
      ]);
      return true;
    } catch {
      // A rejected ClipboardItem write must not leave the previous screenshot in place.
    }
  }
  if (!navigator.clipboard.writeText) return false;
  try {
    await navigator.clipboard.writeText(await clipboardText);
    return true;
  } catch {
    return false;
  }
}

function estimateDataUrlLength(blob: Blob) {
  const mimeType = blob.type || 'application/octet-stream';
  return `data:${mimeType};base64,`.length + Math.ceil(blob.size / 3) * 4;
}

function payloadLengthWithObjectUrl(
  payload: SlideClipboardState,
  assetId: string,
  nextObjectUrlLength: number,
) {
  const currentLength = payload.assets[assetId]?.objectUrl?.length ?? 0;
  return JSON.stringify(payload).length - currentLength + nextObjectUrlLength;
}

function withAssetObjectUrl(payload: SlideClipboardState, assetId: string, objectUrl: string) {
  const asset = payload.assets[assetId];
  if (!asset) return payload;
  return {
    ...payload,
    assets: {
      ...payload.assets,
      [assetId]: { ...asset, objectUrl },
    },
  };
}

function retainBlobReference(payload: SlideClipboardState, assetId: string, blob: Blob) {
  return withAssetObjectUrl(payload, assetId, slideClipboardMedia.remember(blob));
}

function omitOversizedClipboardMedia(payload: SlideClipboardState): SlideClipboardState {
  const assets = Object.fromEntries(
    Object.entries(payload.assets).map(([assetId, asset]) => {
      const objectUrl = asset.objectUrl ?? '';
      const keepReference =
        objectUrl.startsWith('blob:') ||
        slideClipboardMedia.isClipboardMediaReference(objectUrl) ||
        (objectUrl.length < 2048 && !objectUrl.startsWith('data:'));
      if (keepReference) return [assetId, asset] as const;
      return [assetId, { ...asset, objectUrl: '' }] as const;
    }),
  );
  return { ...payload, assets };
}

async function readPrimarySlideClipboardPayload() {
  if (!navigator.clipboard?.read) return undefined;
  try {
    const items = await navigator.clipboard.read();
    const item = items[0];
    if (!item || !textPrecedesImage(Array.from(item.types))) return undefined;
    const blob = await item.getType('text/plain');
    return slidePayloadFromClipboardText(await blob.text());
  } catch {
    return undefined;
  }
}

async function makeSlideClipboardPayloadTransferable(
  payload: SlideClipboardState,
  requestFetch: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  await slideClipboardMedia.beginCopy();
  let nextPayload = payload;
  let omittedMedia = false;
  let retainedOversizedMedia = false;
  for (const [assetId, asset] of Object.entries(payload.assets)) {
    if (!assetFileUtils.isBlobUrl(asset.objectUrl)) continue;
    try {
      const blob = await assetFileUtils.objectUrlToBlob(asset.objectUrl, requestFetch);
      if (
        payloadLengthWithObjectUrl(nextPayload, assetId, estimateDataUrlLength(blob)) >
        MAX_SLIDE_CLIPBOARD_BYTES
      ) {
        nextPayload = retainBlobReference(nextPayload, assetId, blob);
        retainedOversizedMedia = true;
        continue;
      }
      const dataUrl = await assetFileUtils.blobToDataUrl(blob);
      if (payloadLengthWithObjectUrl(nextPayload, assetId, dataUrl.length) > MAX_SLIDE_CLIPBOARD_BYTES) {
        nextPayload = retainBlobReference(nextPayload, assetId, blob);
        retainedOversizedMedia = true;
        continue;
      }
      nextPayload = withAssetObjectUrl(nextPayload, assetId, dataUrl);
    } catch {
      // Keep the original object URL so a same-session paste can still resolve it.
    }
  }

  if (JSON.stringify(nextPayload).length > MAX_SLIDE_CLIPBOARD_BYTES) {
    const stripped = omitOversizedClipboardMedia(nextPayload);
    omittedMedia = JSON.stringify(stripped) !== JSON.stringify(nextPayload);
    nextPayload = stripped;
  }
  if (retainedOversizedMedia) {
    await slideClipboardMedia.persist().catch(() => undefined);
  }

  return { omittedMedia, payload: nextPayload, retainedOversizedMedia };
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
  return slidePayloadFromClipboardText(clipboardData?.getData?.('text/plain') ?? '');
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
  readPendingSlideClipboardText,
  writeSlideClipboardTextSynchronously,
  writeSlideClipboardPayload,
  readPrimarySlideClipboardPayload,
  makeSlideClipboardPayloadTransferable,
  copySlideToClipboard,
  readSlideClipboardPayload,
  isWebMcpEnabled,
  isWebMcpProtocolEnabled,
  getWebMcpModelContext,
};
