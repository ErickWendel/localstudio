export interface BrowserKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function getBrowserLocalStorage(): BrowserKeyValueStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export function readStorageJson<T>(storage: BrowserKeyValueStorage | undefined, key: string): T | null {
  const rawValue = storage?.getItem(key);
  if (!rawValue) return null;
  return JSON.parse(rawValue) as T;
}

export function writeStorageJson<T>(storage: BrowserKeyValueStorage | undefined, key: string, value: T): void {
  storage?.setItem(key, JSON.stringify(value));
}
