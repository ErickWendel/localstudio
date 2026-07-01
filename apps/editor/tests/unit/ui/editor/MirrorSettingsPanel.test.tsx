import { render, screen } from '@testing-library/react';
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
    expect(await screen.findByText('Connection is ready.')).toBeInTheDocument();
    expect(
      screen.getByText('Default MinIO login: localstudio / localstudio123'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open public bucket' })).toHaveAttribute(
      'href',
      'http://localhost:9000/localstudio',
    );
    expect(screen.getByRole('link', { name: 'Open MinIO console' })).toHaveAttribute(
      'href',
      'http://localhost:9000',
    );

    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'public-projects' }));
  });
});
