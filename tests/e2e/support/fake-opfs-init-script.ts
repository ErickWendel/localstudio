import { fakeOpfsDirectoryHandleRuntime } from './fake-opfs-directory-handle-runtime';
import { fakeOpfsFileHandleRuntime } from './fake-opfs-file-handle-runtime';
import { fakeOpfsPathRuntime } from './fake-opfs-path-runtime';
import type { FakeOpfsOptions } from './fake-opfs-types';

export const fakeOpfsInitScript = {
  build(options: FakeOpfsOptions = {}) {
    const payload = {
      directoryPermission: options.directoryPermission ?? 'granted',
      directoryPicker: options.directoryPicker ?? false,
      filePrefix: 'localstudio.e2e.opfs.file:',
    };
    return `
      (() => {
        const payload = ${JSON.stringify(payload)};
        const pathRuntime = (${fakeOpfsPathRuntime.source()})(payload.filePrefix);
        const FakeFileHandle = (${fakeOpfsFileHandleRuntime.source()})(pathRuntime.fileKey);
        const FakeDirectoryHandle = (${fakeOpfsDirectoryHandleRuntime.source()})(
          pathRuntime,
          FakeFileHandle,
          payload.directoryPermission
        );
        const showDirectoryPicker = payload.directoryPicker
          ? async () => {
              await Promise.resolve();
              return new FakeDirectoryHandle('localstudio-e2e-root', 'localstudio-e2e-root');
            }
          : undefined;
        Object.defineProperty(window, 'showDirectoryPicker', {
          configurable: true,
          value: showDirectoryPicker,
        });
        Object.defineProperty(globalThis, 'showDirectoryPicker', {
          configurable: true,
          value: showDirectoryPicker,
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
          const storagePrototype = Object.getPrototypeOf(navigator.storage);
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
      })();
    `;
  },
};
