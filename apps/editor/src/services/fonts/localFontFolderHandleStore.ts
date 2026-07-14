interface LocalFontFolderHandleStoreOptions {
  indexedDB?: IDBFactory | undefined;
}

const DATABASE_NAME = 'localstudio-local-font-mirror';
const DATABASE_VERSION = 1;
const STORE_NAME = 'handles';
const FONT_DIRECTORY_HANDLE_KEY = 'font-directory';

function getIndexedDB(options: LocalFontFolderHandleStoreOptions) {
  if (options.indexedDB) return options.indexedDB;
  if (typeof indexedDB === 'undefined') return undefined;
  return indexedDB;
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open font folder store.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Font folder store failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Font folder store was aborted.'));
  });
}

export const localFontFolderHandleStore = {
  async load(options: LocalFontFolderHandleStoreOptions = {}) {
    const factory = getIndexedDB(options);
    if (!factory) return undefined;
    const database = await openDatabase(factory);
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(FONT_DIRECTORY_HANDLE_KEY);
      const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
        request.onerror = () => reject(request.error ?? new Error('Could not read font folder handle.'));
        request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle | undefined);
      });
      await transactionComplete(transaction);
      return handle;
    } finally {
      database.close();
    }
  },

  async save(handle: FileSystemDirectoryHandle, options: LocalFontFolderHandleStoreOptions = {}) {
    const factory = getIndexedDB(options);
    if (!factory) throw new Error('This browser cannot remember a font folder.');
    const database = await openDatabase(factory);
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(handle, FONT_DIRECTORY_HANDLE_KEY);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  },
};
