import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices } from '../../../../src/app/composition';
import { InMemoryModelSetupService } from '../../../../src/services/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/EditorShell';

describe('mocked AI flows', () => {
  it('downloads required models from AI Tools panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Required Models' }));

    expect(await screen.findAllByText('Ready')).toHaveLength(1);
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
  });

  it('exposes selected-object AI shortcuts', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
    expect(screen.getByLabelText('Translate This Design')).toBeInTheDocument();
  });
});
