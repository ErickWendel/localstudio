import { vi } from 'vitest';

function createClipboardData(options: { editorObject?: boolean; files?: File[] } = {}) {
  const data = new Map<string, string>();
  if (options.editorObject) data.set('application/x-localstudio-editor-elements', '1');
  const types = Array.from(data.keys());

  return {
    files: options.files ?? [],
    items: [],
    types,
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
      if (!types.includes(type)) types.push(type);
    }),
  };
}

export const editorShellClipboardFixtures = {
  createClipboardData,
};
