export function installOversizedClipboardReader() {
  const oversizedDataUrl = `data:image/gif;base64,${'a'.repeat(16 * 1024 * 1024)}`;
  FileReader.prototype.readAsDataURL = function readOversizedDataUrl() {
    Object.defineProperty(this, 'result', {
      configurable: true,
      value: oversizedDataUrl,
    });
    queueMicrotask(() => {
      this.dispatchEvent(new ProgressEvent('load'));
    });
  };
}

export function pasteClipboardText(payload: string) {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', payload);
  window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData }));
}
