import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { aiFlowTestFixtures } from './aiFlows.fixtures';

const {
  TestPromptService,
  createAppServices,
  createImageExample,
  promptExampleLabels,
} = aiFlowTestFixtures;

describe('mocked AI prompt flows', () => {
  it('exposes selected-object AI shortcuts', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Selected Image' }));
    expect(screen.getByLabelText('BG Remover')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Title' }));
    expect(screen.getByLabelText('Translate Selected Text')).toBeInTheDocument();
  });

  it('starts in create image mode from the prompt bar', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('Create image')).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: createImageExample,
      }),
    ).toBeInTheDocument();
  });

  it('fills the prompt from contextual examples', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(
      screen.getByRole('button', {
        name: createImageExample,
      }),
    );

    expect(screen.getByLabelText('Create image prompt')).toHaveValue(createImageExample);

    await user.clear(screen.getByLabelText('Create image prompt'));
    await user.click(
      screen.getByRole('button', {
        name: promptExampleLabels.leftHeroSlide,
      }),
    );

    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue(
      promptExampleLabels.leftHeroSlide,
    );
    expect(screen.getByRole('button', { name: promptExampleLabels.gridSlide })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: promptExampleLabels.bulletsSlide })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: promptExampleLabels.urlImageSlide })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: promptExampleLabels.colorsSlide })).toBeInTheDocument();
  });

  it('clears create image mode when the prompt text is deleted', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'hero image');
    await user.clear(screen.getByLabelText('Create image prompt'));

    await waitFor(() => {
      expect(screen.queryByText('Create image')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue('');
    expect(
      screen.getByPlaceholderText('Describe slide structure or organize current content...'),
    ).toBeInTheDocument();
  });

  it('clears create image mode when the mode token is clicked', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Remove Create image mode' }));

    expect(screen.queryByRole('button', { name: 'Remove Create image mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue('');
  });

  it('generates a slide progressively from the default prompt bar mode', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new TestPromptService('ready');
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'switch mode');
    await user.clear(screen.getByLabelText('Create image prompt'));
    await user.click(
      screen.getByRole('button', {
        name: promptExampleLabels.bulletsSlide,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(promptService.generateSlideTasksFromPrompt).toHaveBeenCalledWith(
        promptExampleLabels.bulletsSlide,
        expect.any(Object),
      );
      expect(promptService.generateSlideElementFromTask).toHaveBeenCalled();
    });
    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('shows a tooltip when image generation is requested outside Create image mode', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new TestPromptService('ready');
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'switch mode');
    await user.clear(screen.getByLabelText('Create image prompt'));
    await user.type(screen.getByRole('textbox', { name: 'Slide structure prompt' }), 'generate an image of a frozen tree');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    expect(promptService.generateSlideTasksFromPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('Use Create image from the + menu to generate images.')).toBeInTheDocument();
  });
});
