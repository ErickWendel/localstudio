import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MediaIntegrationSettingsPanel } from '../../../../src/ui/editor/panels/MediaIntegrationSettingsPanel';

describe('MediaIntegrationSettingsPanel', () => {
  it('shows saved keys as masked fields and lets users reveal and save them', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <MediaIntegrationSettingsPanel
        config={{ giphyApiKey: 'saved-giphy-key', unsplashAccessKey: 'saved-unsplash-key' }}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Unsplash configured')).toBeInTheDocument();
    expect(screen.getByText('GIPHY configured')).toBeInTheDocument();
    expect(screen.getByLabelText('Unsplash access key')).toHaveValue('saved-unsplash-key');
    expect(screen.getByLabelText('Unsplash access key')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('GIPHY API key')).toHaveValue('saved-giphy-key');
    expect(screen.getByLabelText('GIPHY API key')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Save media integrations' })).toHaveClass(
      'export-button',
      'font-orbitron',
    );
    expect(screen.getByText('Unsplash access key')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See how to get an Unsplash access key' })).toHaveTextContent(
      'See how',
    );
    expect(screen.getByRole('link', { name: 'See how to get an Unsplash access key' })).toHaveAttribute(
      'href',
      'https://unsplash.com/documentation?utm_source=localstudio.dev#creating-a-developer-account',
    );
    expect(screen.getByText('GIPHY API key')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See how to get a GIPHY API key' })).toHaveTextContent(
      'See how',
    );
    expect(screen.getByRole('link', { name: 'See how to get a GIPHY API key' })).toHaveAttribute(
      'href',
      'https://developers.giphy.com/docs/api/?utm_source=localstudio.dev#quick-start-guide',
    );

    await user.click(screen.getByRole('button', { name: 'Show Unsplash access key' }));
    await user.click(screen.getByRole('button', { name: 'Show GIPHY API key' }));
    expect(screen.getByLabelText('Unsplash access key')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('GIPHY API key')).toHaveAttribute('type', 'text');

    await user.clear(screen.getByLabelText('Unsplash access key'));
    await user.type(screen.getByLabelText('Unsplash access key'), 'new-unsplash-key');
    await user.clear(screen.getByLabelText('GIPHY API key'));
    await user.type(screen.getByLabelText('GIPHY API key'), 'new-giphy-key');
    await user.click(screen.getByRole('button', { name: 'Save media integrations' }));

    expect(onSave).toHaveBeenCalledWith({
      giphyApiKey: 'new-giphy-key',
      unsplashAccessKey: 'new-unsplash-key',
    });
  });

  it('returns to the settings list from the back button', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <MediaIntegrationSettingsPanel
        config={null}
        onBack={onBack}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back to settings' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('clears saved API keys', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <MediaIntegrationSettingsPanel
        config={{ giphyApiKey: 'saved-giphy-key', unsplashAccessKey: 'saved-unsplash-key' }}
        onClear={onClear}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Clear media integrations' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
