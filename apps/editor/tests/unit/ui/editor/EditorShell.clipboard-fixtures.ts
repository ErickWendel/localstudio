import { vi } from 'vitest';

function createClipboardData(options: { editorObject?: boolean; files?: File[] } = {}) {
  const data = new Map<string, string>();
  if (options.editorObject) data.set('application/x-localstudio-editor-elements', '1');

  return {
    files: options.files ?? [],
    items: [],
    types: Array.from(data.keys()),
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
  };
}

export const editorShellClipboardFixtures = {
  createClipboardData,
};
