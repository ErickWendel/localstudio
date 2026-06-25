import { createSampleProject } from '../../../src/domain/sampleProject';
import { IndexedDbProjectRepository } from '../../../src/services/indexedDbProjectRepository';

describe('IndexedDbProjectRepository', () => {
  it('saves and loads the current project', async () => {
    const repository = new IndexedDbProjectRepository('ew-canvas-test');
    const project = createSampleProject();

    await repository.saveProject(project);
    const loaded = await repository.loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(loaded?.pages).toHaveLength(1);
  });
});
