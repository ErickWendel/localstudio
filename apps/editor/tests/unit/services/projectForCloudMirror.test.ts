import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { projectForCloudMirror } from '../../../src/services/mirror/projectForCloudMirror';

describe('projectForCloudMirror', () => {
  it('uses the current persisted project and releases only its new object URLs', () => {
    const inMemoryProject = sampleProject.createSampleProject();
    const heroAsset = inMemoryProject.assets['asset-hero'];
    if (!heroAsset) throw new Error('Sample project must include the hero asset.');
    inMemoryProject.assets['asset-hero'] = {
      ...heroAsset,
      objectUrl: 'data:image/png;base64,aGVyby1ieXRlcw==',
    };
    const persistedProject = {
      ...inMemoryProject,
      assets: {
        ...inMemoryProject.assets,
        'asset-hero': {
          ...heroAsset,
          fileName: 'hero.png',
          objectUrl: 'blob:persisted-hero',
          storage: 'file' as const,
        },
      },
    };
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const mirrorProject = projectForCloudMirror(inMemoryProject, persistedProject);

    expect(mirrorProject.project).toBe(persistedProject);
    mirrorProject.release();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:persisted-hero');
  });

  it('keeps an unsaved in-memory project when the persisted copy is older', () => {
    const inMemoryProject = sampleProject.createSampleProject();
    inMemoryProject.updatedAt = '2026-09-23T20:00:00.000Z';
    const persistedProject = {
      ...inMemoryProject,
      updatedAt: '2026-09-23T19:00:00.000Z',
      assets: {
        ...inMemoryProject.assets,
        'asset-hero': {
          ...inMemoryProject.assets['asset-hero']!,
          objectUrl: 'blob:stale-persisted-hero',
        },
      },
    };
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const mirrorProject = projectForCloudMirror(inMemoryProject, persistedProject);

    expect(mirrorProject.project).toBe(inMemoryProject);
    mirrorProject.release();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stale-persisted-hero');
  });

  it('keeps the in-memory paste when the persisted snapshot is missing that page', () => {
    const inMemoryProject = sampleProject.createSampleProject();
    const persistedProject = {
      ...inMemoryProject,
      pages: inMemoryProject.pages.slice(0, -1),
    };
    if (persistedProject.pages.length === inMemoryProject.pages.length) {
      persistedProject.pages = [];
    }

    expect(projectForCloudMirror(inMemoryProject, persistedProject).project).toBe(inMemoryProject);
  });
});
