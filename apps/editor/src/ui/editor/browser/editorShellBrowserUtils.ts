import type { WebMcpModelContext } from '../../../services/webmcp/webMcpToolAdapter';

const EDITOR_OBJECT_CLIPBOARD_TYPE = 'application/x-localstudio-editor-elements';
const EDITOR_OBJECT_CLIPBOARD_MARKER = '1';

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
  isWebMcpEnabled,
  isWebMcpProtocolEnabled,
  getWebMcpModelContext,
};
