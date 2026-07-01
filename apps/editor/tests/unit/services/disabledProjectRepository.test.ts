import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { DisabledProjectRepository } from '../../../src/services/storage/disabledProjectRepository';

describe('DisabledProjectRepository', () => {
  it('does not persist or reload project changes', async () => {
    const repository = new DisabledProjectRepository();
    const project = sampleProject.createSampleProject();

    await repository.saveProject(project);

    await expect(repository.loadProject()).resolves.toBeNull();
  });
});
