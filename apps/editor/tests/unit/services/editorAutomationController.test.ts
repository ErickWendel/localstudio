import { EditorAutomationController } from '../../../src/services/editorAutomationController';
import type { ProjectDocument } from '../../../src/domain/model';
import { createSampleProject } from '../../../src/domain/sampleProject';

function projectWithName(name: string): ProjectDocument {
  return {
    ...createSampleProject(),
    name,
  };
}

describe('EditorAutomationController', () => {
  it('creates a project through the automation delegate', async () => {
    const controller = new EditorAutomationController({
      createProject: vi.fn(() => Promise.resolve(projectWithName('Agent Deck'))),
      generateSlides: vi.fn(),
      generateImage: vi.fn(),
      translateText: vi.fn(),
      getState: () => ({ project: projectWithName('Agent Deck'), selection: { pageId: 'page-1', elementIds: [] } }),
    });

    await expect(controller.createProject({ name: 'Agent Deck' })).resolves.toMatchObject({
      ok: true,
      data: {
        projectId: 'project-1',
        name: 'Agent Deck',
        pageCount: 1,
      },
    });
  });

  it('generates slides and returns a compact project snapshot', async () => {
    const nextProject = projectWithName('Generated Deck');
    const controller = new EditorAutomationController({
      createProject: vi.fn(),
      generateSlides: vi.fn(() => Promise.resolve(nextProject)),
      generateImage: vi.fn(),
      translateText: vi.fn(),
      getState: () => ({ project: nextProject, selection: { pageId: 'page-1', elementIds: ['text-title'] } }),
    });

    const result = await controller.generateSlides({ prompt: 'Three-image grid about Web AI, with matching captions.' });

    expect(result).toMatchObject({
      ok: true,
      data: {
        snapshot: {
          projectId: 'project-1',
          name: 'Generated Deck',
          pages: [{ id: 'page-1', elementCount: 3 }],
          selection: { pageId: 'page-1', elementIds: ['text-title'] },
        },
      },
    });
  });

  it('rejects concurrent long-running work with a busy error', async () => {
    let resolveGeneration: ((project: ProjectDocument) => void) | undefined;
    const controller = new EditorAutomationController({
      createProject: vi.fn(),
      generateSlides: vi.fn(
        () =>
          new Promise<ProjectDocument>((resolve) => {
            resolveGeneration = resolve;
          }),
      ),
      generateImage: vi.fn(),
      translateText: vi.fn(),
      getState: () => ({ project: createSampleProject(), selection: { pageId: 'page-1', elementIds: [] } }),
    });

    const firstRun = controller.generateSlides({ prompt: 'Top title and three body bullets about why Web AI is useful.' });
    await expect(controller.generateImage({ prompt: 'Create a local Web AI hero image' })).resolves.toEqual({
      ok: false,
      errorCode: 'busy',
      message: 'Another automation action is already running.',
    });
    resolveGeneration?.(createSampleProject());
    await firstRun;
  });

  it('validates translation scope and image dimensions before calling the delegate', async () => {
    const generateImage = vi.fn();
    const translateText = vi.fn();
    const controller = new EditorAutomationController({
      createProject: vi.fn(),
      generateSlides: vi.fn(),
      generateImage,
      translateText,
      getState: () => ({ project: createSampleProject(), selection: { pageId: 'page-1', elementIds: [] } }),
    });

    await expect(controller.generateImage({ prompt: 'Create an image', width: 15 })).resolves.toMatchObject({
      ok: false,
      errorCode: 'invalid_image_dimensions',
    });
    await expect(controller.translateText({ scope: 'page', targetLanguage: 'pt' })).resolves.toMatchObject({
      ok: false,
      errorCode: 'invalid_translation_scope',
    });
    expect(generateImage).not.toHaveBeenCalled();
    expect(translateText).not.toHaveBeenCalled();
  });
});
