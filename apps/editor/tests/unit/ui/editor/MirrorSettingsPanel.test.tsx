import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MirrorSettingsPanel } from '../../../../src/ui/editor/panels/MirrorSettingsPanel';
import type { MinioMirrorConfig } from '../../../../src/services/mirror/minioMirrorService';

const config: MinioMirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
  prefix: 'mirrors',
};

describe('MirrorSettingsPanel', () => {
  it('closes when clicking outside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">Outside target</button>
        <MirrorSettingsPanel
          config={config}
          mirrorState={{ enabled: true, status: 'idle' }}
          onClose={onClose}
          onEnabledChange={vi.fn()}
          onSave={vi.fn()}
          onTestConnection={vi.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Outside target' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows prefilled MinIO settings and tests the current connection', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();
    const onTestConnection = vi.fn(() => Promise.resolve());

    render(
      <MirrorSettingsPanel
        config={config}
        mirrorState={{ enabled: true, status: 'idle' }}
        onClose={onClose}
        onEnabledChange={vi.fn()}
        onSave={onSave}
        onTestConnection={onTestConnection}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Endpoint')).toHaveValue('http://localhost:9000');
    expect(screen.getByLabelText('Bucket')).toHaveValue('localstudio');
    const secretInput = screen.getByLabelText('Secret key');
    expect(secretInput).toHaveValue('localstudio123');
    expect(secretInput).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Path-style URLs')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Show secret key' }));
    expect(secretInput).toHaveAttribute('type', 'text');

    await user.clear(screen.getByLabelText('Prefix'));
    await user.type(screen.getByLabelText('Prefix'), 'public-projects');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(onTestConnection).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'public-projects' }),
    );
    expect(await screen.findByText('S3-compatible connection is ready.')).toBeInTheDocument();
    expect(
      screen.getByText('Local S3-compatible default login: localstudio / localstudio123'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open public bucket' })).toHaveAttribute(
      'href',
      'http://localhost:9000/localstudio',
    );
    expect(screen.getByRole('link', { name: 'Open storage console' })).toHaveAttribute(
      'href',
      'http://localhost:9000',
    );

    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'public-projects' }));
  });

  it('returns to the settings list from the back button', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <MirrorSettingsPanel
        config={config}
        mirrorState={{ enabled: true, status: 'idle' }}
        onBack={onBack}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back to settings' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('lets users disable mirroring from settings and keeps saving settings disabled while off', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    const onSave = vi.fn();
    const onTestConnection = vi.fn(() => Promise.resolve());

    function StatefulMirrorSettingsPanel() {
      const [enabled, setEnabled] = useState(true);
      return (
        <MirrorSettingsPanel
          config={config}
          mirrorDisabledBySettings={!enabled}
          mirrorState={{ enabled, status: enabled ? 'idle' : 'disabled' }}
          onClose={vi.fn()}
          onEnabledChange={(nextEnabled) => {
            setEnabled(nextEnabled);
            onEnabledChange(nextEnabled);
          }}
          onSave={onSave}
          onTestConnection={onTestConnection}
        />
      );
    }

    render(<StatefulMirrorSettingsPanel />);

    expect(screen.getByRole('button', { name: 'Disable mirroring' })).toHaveClass(
      'mirror-settings-toggle-danger',
    );

    await user.click(screen.getByRole('button', { name: 'Disable mirroring' }));

    expect(onEnabledChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Enable mirroring' })).toHaveClass(
      'mirror-settings-toggle-success',
    );
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Enable mirroring' }));

    expect(onEnabledChange).toHaveBeenLastCalledWith(true);
    expect(onTestConnection).toHaveBeenCalledWith(config);
    expect(await screen.findByText('S3-compatible connection is ready.')).toBeInTheDocument();
  });
});
