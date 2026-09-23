import type { SlideClipboardState } from '../state/editorViewModelElements';

const clipboardMediaReferencePrefix = 'localstudio-clipboard:';
const databaseName = 'localstudio-slide-clipboard';
const databaseVersion = 1;
const storeName = 'blobs';

function isClipboardMediaReference(objectUrl: string | undefined) {
  return Boolean(objectUrl?.startsWith(clipboardMediaReferencePrefix));
}

function referenceId(objectUrl: string) {
  return objectUrl.slice(clipboardMediaReferencePrefix.length);
}

function openDatabase(factory: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open the slide clipboard.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Slide clipboard store failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Slide clipboard store was aborted.'));
  });
}

function getIndexedDB() {
  if (typeof indexedDB === 'undefined') return undefined;
  return indexedDB;
}

function createObjectUrl(blob: Blob) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined;
  return URL.createObjectURL(blob);
}

const rememberedBlobs = new Map<string, Blob>();
let nextReferenceId = 0;

function beginCopy() {
  rememberedBlobs.clear();
  const factory = getIndexedDB();
  if (!factory) return Promise.resolve();
  return openDatabase(factory)
    .then(async (database) => {
      try {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).clear();
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    })
    .catch(() => undefined);
}

function remember(blob: Blob) {
  const id = `${Date.now()}-${(nextReferenceId += 1)}`;
  rememberedBlobs.set(id, blob);
  return `${clipboardMediaReferencePrefix}${id}`;
}

async function persist() {
  const factory = getIndexedDB();
  if (!factory || rememberedBlobs.size === 0) return;
  const database = await openDatabase(factory);
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
    for (const [id, blob] of rememberedBlobs) {
      store.put(blob, id);
    }
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

function readBlob(objectUrl: string | undefined) {
  if (!objectUrl || !isClipboardMediaReference(objectUrl)) return undefined;
  return rememberedBlobs.get(referenceId(objectUrl));
}

function resolveObjectUrl(objectUrl: string | undefined) {
  const blob = readBlob(objectUrl);
  if (!blob) return objectUrl;
  return createObjectUrl(blob) ?? objectUrl;
}

function resolveSlidePayload(payload: SlideClipboardState): SlideClipboardState {
  const assets: SlideClipboardState['assets'] = {};
  for (const [assetId, asset] of Object.entries(payload.assets)) {
    const objectUrl = resolveObjectUrl(asset.objectUrl);
    assets[assetId] = objectUrl && objectUrl !== asset.objectUrl ? { ...asset, objectUrl } : asset;
  }
  return { ...payload, assets };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readPayloadAssets(payload: unknown) {
  if (!isRecord(payload)) return undefined;
  const assets: unknown = payload.assets;
  if (!isRecord(assets)) return undefined;
  return assets as SlideClipboardState['assets'];
}

function hasExternalReference(payload: unknown) {
  const assets = readPayloadAssets(payload);
  if (!assets) return false;
  return Object.values(assets).some(
    (asset) => isClipboardMediaReference(asset.objectUrl) && !readBlob(asset.objectUrl),
  );
}

async function hydrate(payload: unknown) {
  const assets = readPayloadAssets(payload);
  if (!assets || !payload || typeof payload !== 'object') return payload;
  const slide = payload as SlideClipboardState;
  const missingIds = Object.values(assets).flatMap((asset) => {
    const objectUrl = asset.objectUrl;
    if (!objectUrl || !isClipboardMediaReference(objectUrl) || readBlob(objectUrl)) return [];
    return [referenceId(objectUrl)];
  });
  const factory = getIndexedDB();
  if (factory && missingIds.length > 0) {
    try {
      const database = await openDatabase(factory);
      try {
        const transaction = database.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        await Promise.all(
          missingIds.map(
            (id) =>
              new Promise<void>((resolve, reject) => {
                const request = store.get(id);
                request.onerror = () => reject(request.error ?? new Error('Could not read copied media.'));
                request.onsuccess = () => {
                  if (request.result instanceof Blob) rememberedBlobs.set(id, request.result);
                  resolve();
                };
              }),
          ),
        );
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    } catch {
      // Same-tab copies still resolve from memory when IndexedDB is unavailable.
    }
  }
  return resolveSlidePayload(slide);
}

export const slideClipboardMedia = {
  beginCopy,
  hasExternalReference,
  hydrate,
  isClipboardMediaReference,
  persist,
  remember,
  resolveSlidePayload,
};
