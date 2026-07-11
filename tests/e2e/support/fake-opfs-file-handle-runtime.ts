export const fakeOpfsFileHandleRuntime = {
  source() {
    return createFakeOpfsFileHandleClass.toString();
  },
};

function createFakeOpfsFileHandleClass(fileKey: (path: string) => string) {
  return class FakeFileHandle {
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
  };
}
