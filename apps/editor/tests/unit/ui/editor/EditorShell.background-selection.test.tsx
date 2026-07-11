import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  InstantBackgroundRemovalService,
  createAppServices,
  selectImageLayer,
} = editorShellTestHarness;

describe('EditorShell background selection workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('blocks background subject selection until image editing models are downloaded', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      screen.getByText('You must download the image editing tools first.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Download Image Editing Models' })).toHaveClass(
      'icon-button-attention',
    );

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText('You must download the image editing tools first.'),
    ).not.toBeInTheDocument();
  });

  it('enters and cancels background subject selection after image editing models are ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.backgroundRemovalService = new InstantBackgroundRemovalService();
    await services.modelSetupService.downloadModel('image-editing-models');

    render(<EditorShell services={services} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      await screen.findByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel BG Remover' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
  });
});
