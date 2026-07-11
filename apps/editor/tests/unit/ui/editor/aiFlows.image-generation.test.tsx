import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Asset } from '../../../../src/domain/documents/model';
import type { ImageGenerationOptions } from '../../../../src/services/contracts/interfaces';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { inMemoryAiServices } from '../../../../src/services/testing/inMemoryAiServices';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { aiFlowTestFixtures } from './aiFlows.fixtures';

const {
  DeferredImageGenerationService,
  SlowImageGenerationService,
  createAppServices,
} = aiFlowTestFixtures;

describe('mocked AI image generation flows', () => {
  it('redirects create image prompt typing to AI Tools when image generation models are not ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'cyberpunk course cover');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByRole('article', { name: 'Image Generation Models' })).toHaveClass('model-row-attention');
    expect(screen.getByText('Download image generation models before creating images.')).toBeInTheDocument();
  });

  it('downloads image generation models before allowing create image prompts', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));

    await waitFor(() => {
      expect(screen.getByRole('article', { name: 'Image Generation Models' })).toHaveTextContent('Ready');
    });

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'neon cover');

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('neon cover');
  });

  it('generates an image from create image mode and inserts it into the active slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = new inMemoryAiServices.MockImageGenerationService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A neon bonsai browser');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    expect(await screen.findByText('A neon bonsai browser.png')).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('passes selected create image options to the generator', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const generateImage = vi.fn((_prompt: string, options?: ImageGenerationOptions): Promise<Asset> => {
      options?.onProgress?.({ label: 'Generating image 1/4', progress: 25 });
      return Promise.resolve({
        id: 'asset-generated-wide',
        type: 'image',
        name: 'wide.png',
        mimeType: 'image/png',
        objectUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
      });
    });
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = { generateImage };
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('button', { name: '16:9' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A wide generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledWith(
        'A wide generated image',
        expect.objectContaining({
          height: 432,
          steps: 4,
          width: 768,
        }),
      );
    });
  });

  it('replaces the selected image using the selected image frame as generation size', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const generateImage = vi.fn((_prompt: string, options?: ImageGenerationOptions): Promise<Asset> => {
      options?.onProgress?.({ label: 'Generating replacement 1/4', progress: 25 });
      return Promise.resolve({
        id: 'asset-generated-replacement',
        type: 'image',
        name: 'replacement.png',
        mimeType: 'image/png',
        objectUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
      });
    });
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = { generateImage };
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('button', { name: '16:9' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Selected Image' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'Replace with a neon studio');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledWith(
        'Replace with a neon studio',
        expect.objectContaining({
          height: 736,
          width: 976,
        }),
      );
    });
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('shows a stop action instead of allowing duplicate create image submissions', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const imageGenerationService = new SlowImageGenerationService();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = imageGenerationService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A slow generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('A slow generated image');

    expect(screen.getByLabelText('Create image prompt')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    expect(await screen.findByText('Generating image 1/4 25%')).toBeInTheDocument();
    await waitFor(() => {
      expect(imageGenerationService.generateImage).toHaveBeenCalledTimes(1);
    });
  });

  it('disables the prompt input while generating and stops late image results', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const imageGenerationService = new DeferredImageGenerationService();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = imageGenerationService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A slow generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    expect(screen.getByLabelText('Create image prompt')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Stop generation' }));
    expect(screen.getByLabelText('Create image prompt')).not.toBeDisabled();

    imageGenerationService.resolve({
      id: 'asset-cancelled-generated',
      type: 'image',
      name: 'cancelled.png',
      mimeType: 'image/png',
      objectUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
    });

    await waitFor(() => {
      expect(screen.queryByText('cancelled.png')).not.toBeInTheDocument();
    });
  });
});
