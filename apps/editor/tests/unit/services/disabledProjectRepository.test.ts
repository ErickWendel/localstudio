import { createSampleProject } from '../../../src/domain/sampleProject';
import { DisabledProjectRepository } from '../../../src/services/disabledProjectRepository';

describe('DisabledProjectRepository', () => {
  it('does not persist or reload project changes', async () => {
    const repository = new DisabledProjectRepository();
    const project = createSampleProject();

    await repository.saveProject(project);

    await expect(repository.loadProject()).resolves.toBeNull();
  });
});
