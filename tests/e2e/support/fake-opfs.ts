export function installFakeOpfs() {
  const filePrefix = 'localstudio.e2e.opfs.file:';

  function normalizePath(path: string) {
    return path
      .split('/')
      .filter(Boolean)
      .join('/');
  }

  function fileKey(path: string) {
    return `${filePrefix}${normalizePath(path)}`;
  }

  class FakeFileHandle {
    readonly kind = 'file';

    constructor(
      readonly name: string,
      private readonly path: string,
    ) {}

    async getFile() {
      await Promise.resolve();
      const value = window.localStorage.getItem(fileKey(this.path));
      if (value === null) throw new DOMException('File not found.', 'NotFoundError');
      return new File([value], this.name, { type: 'application/json' });
    }

    async createWritable() {
      await Promise.resolve();
      const path = this.path;
      let chunks = '';
      return {
        async write(value: BlobPart) {
          chunks += typeof value === 'string' ? value : await new Blob([value]).text();
        },
        async close() {
          await Promise.resolve();
          window.localStorage.setItem(fileKey(path), chunks);
        },
      };
    }
  }

  class FakeDirectoryHandle {
    readonly kind = 'directory';

    constructor(
      readonly name: string,
      private readonly path = '',
    ) {}

    async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
      await Promise.resolve();
      const nextPath = normalizePath(`${this.path}/${name}`);
      if (!options.create && !hasDirectory(nextPath)) {
        throw new DOMException('Directory not found.', 'NotFoundError');
      }
      return new FakeDirectoryHandle(name, nextPath);
    }

    async getFileHandle(name: string, options: { create?: boolean } = {}) {
      await Promise.resolve();
      const nextPath = normalizePath(`${this.path}/${name}`);
      if (!options.create && window.localStorage.getItem(fileKey(nextPath)) === null) {
        throw new DOMException('File not found.', 'NotFoundError');
      }
      return new FakeFileHandle(name, nextPath);
    }

    async removeEntry(name: string, options: { recursive?: boolean } = {}) {
      await Promise.resolve();
      const targetPath = normalizePath(`${this.path}/${name}`);
      const targetFileKey = fileKey(targetPath);
      if (window.localStorage.getItem(targetFileKey) !== null) {
        window.localStorage.removeItem(targetFileKey);
        return;
      }
      if (!options.recursive && hasDirectory(targetPath)) {
        throw new DOMException('Directory is not empty.', 'InvalidModificationError');
      }
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(`${filePrefix}${targetPath}/`)) window.localStorage.removeItem(key);
      }
    }

    async *entries(): AsyncIterable<[string, { kind: string }]> {
      await Promise.resolve();
      const prefix = normalizePath(this.path);
      const seen = new Set<string>();
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(filePrefix)) continue;
        const path = key.slice(filePrefix.length);
        if (prefix && !path.startsWith(`${prefix}/`)) continue;
        const relativePath = prefix ? path.slice(prefix.length + 1) : path;
        const [name, ...rest] = relativePath.split('/');
        if (!name || seen.has(name)) continue;
        seen.add(name);
        yield [name, { kind: rest.length > 0 ? 'directory' : 'file' }];
      }
    }
  }

  function hasDirectory(path: string) {
    const prefix = `${filePrefix}${normalizePath(path)}/`;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      if (window.localStorage.key(index)?.startsWith(prefix)) return true;
    }
    return false;
  }

  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, 'showDirectoryPicker', {
    configurable: true,
    value: undefined,
  });
  const getDirectory = async () => {
    await Promise.resolve();
    return new FakeDirectoryHandle('opfs-root');
  };
  if (navigator.storage) {
    Object.defineProperty(navigator.storage, 'getDirectory', {
      configurable: true,
      value: getDirectory,
    });
    const storagePrototype = Object.getPrototypeOf(navigator.storage) as object | null;
    if (storagePrototype) {
      Object.defineProperty(storagePrototype, 'getDirectory', {
        configurable: true,
        value: getDirectory,
      });
    }
    return;
  }
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { getDirectory },
  });
}
