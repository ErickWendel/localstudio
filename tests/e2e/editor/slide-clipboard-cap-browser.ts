export function installOversizedClipboardReader() {
  const blobDescriptor = Object.getOwnPropertyDescriptor(Response.prototype, 'blob');
  const originalBlob = blobDescriptor?.value as (this: Response) => Promise<Blob>;
  Response.prototype.blob = async function readBlobWithReportedSize(this: Response) {
    const blob = await originalBlob.call(this);
    if (this.url.startsWith('blob:') || blob.type === 'image/gif') {
      Object.defineProperty(blob, 'size', {
        configurable: true,
        value: 200 * 1024 * 1024,
      });
    }
    return blob;
  };
  FileReader.prototype.readAsDataURL = function rejectOversizedDataUrl() {
    throw new Error('Oversized clipboard media must not be encoded.');
  };
}

export function readClipboardText() {
  return navigator.clipboard.readText();
}

export function readCanvasMediaSrc() {
  const media = document.querySelector(
    '[aria-label="Canvas workspace"] img, [aria-label="Canvas workspace"] video',
  );
  return media?.getAttribute('src') ?? '';
}

export function pasteClipboardText(payload: string) {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', payload);
  window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData }));
}
