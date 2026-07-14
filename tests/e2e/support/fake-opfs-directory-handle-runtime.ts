export const fakeOpfsDirectoryHandleRuntime = {
  source() {
    return createFakeOpfsDirectoryHandleClass.toString();
  },
};

function createFakeOpfsDirectoryHandleClass(
  pathRuntime: {
    fileKey: (path: string) => string;
    hasDirectory: (path: string) => boolean;
    normalizePath: (path: string) => string;
  },
  FakeFileHandle: new (name: string, path: string) => { kind: string },
  directoryPermission: PermissionState,
) {
  return class FakeDirectoryHandle {
    readonly kind = 'directory';

    constructor(
      readonly name: string,
      private readonly path = '',
    ) {}

    async queryPermission() {
      await Promise.resolve();
      return directoryPermission;
    }

    async requestPermission() {
      await Promise.resolve();
      return directoryPermission;
    }

    async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
      await Promise.resolve();
      const nextPath = pathRuntime.normalizePath(`${this.path}/${name}`);
      if (!options.create && !pathRuntime.hasDirectory(nextPath)) {
        throw new DOMException('Directory not found.', 'NotFoundError');
      }
      return new FakeDirectoryHandle(name, nextPath);
    }

    async getFileHandle(name: string, options: { create?: boolean } = {}) {
      await Promise.resolve();
      const nextPath = pathRuntime.normalizePath(`${this.path}/${name}`);
      if (!options.create && window.localStorage.getItem(pathRuntime.fileKey(nextPath)) === null) {
        throw new DOMException('File not found.', 'NotFoundError');
      }
      return new FakeFileHandle(name, nextPath);
    }

    async removeEntry(name: string, options: { recursive?: boolean } = {}) {
      await Promise.resolve();
      const targetPath = pathRuntime.normalizePath(`${this.path}/${name}`);
      const targetFileKey = pathRuntime.fileKey(targetPath);
      if (window.localStorage.getItem(targetFileKey) !== null) {
        window.localStorage.removeItem(targetFileKey);
        return;
      }
      if (!options.recursive && pathRuntime.hasDirectory(targetPath)) {
        throw new DOMException('Directory is not empty.', 'InvalidModificationError');
      }
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(`${targetFileKey}/`)) window.localStorage.removeItem(key);
      }
    }

    async *entries(): AsyncIterable<[string, { kind: string }]> {
      await Promise.resolve();
      const prefix = pathRuntime.normalizePath(this.path);
      const seen = new Set<string>();
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(pathRuntime.fileKey(''))) continue;
        const path = key.slice(pathRuntime.fileKey('').length);
        if (prefix && !path.startsWith(`${prefix}/`)) continue;
        const relativePath = prefix ? path.slice(prefix.length + 1) : path;
        const [entryName, ...rest] = relativePath.split('/');
        if (!entryName || seen.has(entryName)) continue;
        seen.add(entryName);
        yield [
          entryName,
          rest.length > 0
            ? new FakeDirectoryHandle(entryName, pathRuntime.normalizePath(`${prefix}/${entryName}`))
            : new FakeFileHandle(entryName, pathRuntime.normalizePath(`${prefix}/${entryName}`)),
        ];
      }
    }
  };
}
