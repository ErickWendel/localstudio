import { describe, expect, it, vi } from 'vitest';
import { materializeLocalAssetFile } from '../../../src/services/storage/materializeLocalAssetFile';

class MemoryFileHandle {
  constructor(
    private readonly name: string,
    private readonly files: Map<string, Blob>,
  ) {}

  createWritable() {
    let value = new Blob();
    return Promise.resolve({
      write: (next: Blob) => {
        value = next;
        return Promise.resolve();
      },
      close: () => {
        this.files.set(this.name, value);
        return Promise.resolve();
      },
    });
  }

  getFile() {
    const file = this.files.get(this.name);
    if (!file) return Promise.reject(new DOMException('Not found', 'NotFoundError'));
    return Promise.resolve(file);
  }
}

class MemoryDirectory {
  readonly files = new Map<string, Blob>();

  getFileHandle(name: string, options?: { create?: boolean }) {
    if (!options?.create && !this.files.has(name)) {
      return Promise.reject(new DOMException('Not found', 'NotFoundError'));
    }
    return Promise.resolve(new MemoryFileHandle(name, this.files));
  }
}

describe('materializeLocalAssetFile', () => {
  it('writes the blob to the local directory and returns an object URL for that file', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-video');
    const directory = new MemoryDirectory();
    const blob = new Blob(['video-bytes'], { type: 'video/mp4' });

    const stored = await materializeLocalAssetFile(
      directory as unknown as FileSystemDirectoryHandle,
      'hero.mp4',
      blob,
    );

    expect(stored).toEqual({ fileName: 'hero.mp4', objectUrl: 'blob:local-video' });
    expect(directory.files.get('hero.mp4')).toBe(blob);
    expect(createObjectUrl).toHaveBeenCalledWith(blob);
  });
});
