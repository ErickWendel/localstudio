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
    };

    expect(projectForCloudMirror(inMemoryProject, persistedProject).project).toBe(inMemoryProject);
  });
});
