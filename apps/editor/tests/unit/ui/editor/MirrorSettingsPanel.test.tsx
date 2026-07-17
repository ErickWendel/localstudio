import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MirrorSettingsPanel } from '../../../../src/ui/editor/panels/MirrorSettingsPanel';
import type { MinioMirrorConfig } from '../../../../src/services/mirror/minioMirrorService';
import type { LocalFontMirrorProgress } from '../../../../src/services/contracts/interfaces';

const config: MinioMirrorConfig = {
  accessKey: 'localstudio-writer',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  readerAccessKey: 'localstudio-reader',
  readerSecretKey: 'localstudio-reader',
  region: 'us-east-1',
  secretKey: 'localstudio-writer',
  writerAccessKey: 'localstudio-writer',
  writerSecretKey: 'localstudio-writer',
  prefix: 'mirrors',
};

const localFontMirrorSettings = {
  enabled: false,
  folderLabel: undefined,
  supported: true,
  systemHint: '~/Library/Fonts or /Library/Fonts',
};

type TestConnectionHandler = (
  config: MinioMirrorConfig,
  options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
) => Promise<string | void>;

describe('MirrorSettingsPanel', () => {
  it('closes when clicking outside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">Outside target</button>
        <MirrorSettingsPanel
          config={config}
          localFontMirrorSettings={localFontMirrorSettings}
          mirrorState={{ enabled: true, status: 'idle' }}
          onChooseLocalFontFolder={vi.fn()}
          onClose={onClose}
          onEnabledChange={vi.fn()}
          onLocalFontMirrorEnabledChange={vi.fn()}
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
    const onTestConnection = vi.fn<TestConnectionHandler>(() => Promise.resolve());

    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={localFontMirrorSettings}
        mirrorState={{ enabled: true, status: 'idle' }}
        onChooseLocalFontFolder={vi.fn()}
        onClose={onClose}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={vi.fn()}
        onSave={onSave}
        onTestConnection={onTestConnection}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('S3 API endpoint')).toHaveValue('http://localhost:9000');
    expect(screen.getByLabelText('Bucket')).toHaveValue('localstudio');
    expect(screen.getByLabelText('Writer access key')).toHaveValue('localstudio-writer');
    expect(screen.getByLabelText('Reader access key')).toHaveValue('localstudio-reader');
    expect(screen.queryByLabelText('Public base URL')).not.toBeInTheDocument();
    const writerSecretInput = screen.getByLabelText('Writer secret key');
    const readerSecretInput = screen.getByLabelText('Reader secret key');
    expect(writerSecretInput).toHaveValue('localstudio-writer');
    expect(readerSecretInput).toHaveValue('localstudio-reader');
    expect(writerSecretInput).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Path-style URLs')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Show secret key' }));
    expect(writerSecretInput).toHaveAttribute('type', 'text');
    expect(readerSecretInput).toHaveAttribute('type', 'text');

    await user.clear(screen.getByLabelText('Prefix'));
    await user.type(screen.getByLabelText('Prefix'), 'public-projects');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(onTestConnection.mock.calls[0]?.[0]).toMatchObject({ prefix: 'public-projects' });
    expect(await screen.findByText('S3-compatible connection is ready.')).toBeInTheDocument();
    expect(screen.getByText(/Public decks should use the read-only key/)).toBeInTheDocument();
    expect(screen.getByText(/writer localstudio-writer/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open public bucket' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open storage console' })).toHaveAttribute(
      'href',
      'http://localhost:9000',
    );

    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: 'public-projects',
        publicBaseUrl: 'http://localhost:9000/localstudio',
        readerAccessKey: 'localstudio-reader',
        writerAccessKey: 'localstudio-writer',
      }),
    );
  });

  it('derives public base URL from endpoint, bucket, and URL mode when saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={localFontMirrorSettings}
        mirrorState={{ enabled: true, status: 'idle' }}
        onChooseLocalFontFolder={vi.fn()}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={vi.fn()}
        onSave={onSave}
        onTestConnection={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText('S3 API endpoint'));
    await user.type(screen.getByLabelText('S3 API endpoint'), 'https://s3.example.test');
    await user.clear(screen.getByLabelText('Bucket'));
    await user.type(screen.getByLabelText('Bucket'), 'decks');
    await user.click(screen.getByLabelText('Path-style URLs'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'decks',
        endpoint: 'https://s3.example.test',
        pathStyle: false,
        publicBaseUrl: 'https://decks.s3.example.test',
      }),
    );
  });

  it('lets users resize the mirror settings panel from the edge handle', () => {
    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={localFontMirrorSettings}
        mirrorState={{ enabled: true, status: 'idle' }}
        onChooseLocalFontFolder={vi.fn()}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
      />,
    );

    const panel = screen.getByRole('dialog', { name: 'Mirror settings' });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: 452,
      height: 400,
      left: 16,
      right: 456,
      top: 52,
      width: 440,
      x: 16,
      y: 52,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Resize mirror settings panel' }), {
      clientX: 456,
      clientY: 240,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientX: 536, clientY: 240, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(panel).toHaveStyle({ '--mirror-settings-panel-width': '520px' });
  });

  it('returns to the settings list from the back button', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={localFontMirrorSettings}
        mirrorState={{ enabled: true, status: 'idle' }}
        onBack={onBack}
        onChooseLocalFontFolder={vi.fn()}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back to settings' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the font folder picker when local font mirroring is enabled', async () => {
    const user = userEvent.setup();
    const onChooseLocalFontFolder = vi.fn(() => Promise.resolve());
    const onLocalFontMirrorEnabledChange = vi.fn();

    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={localFontMirrorSettings}
        mirrorState={{ enabled: true, status: 'idle' }}
        onChooseLocalFontFolder={onChooseLocalFontFolder}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={onLocalFontMirrorEnabledChange}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /Off/i }));

    expect(onChooseLocalFontFolder).toHaveBeenCalledTimes(1);
    expect(onLocalFontMirrorEnabledChange).not.toHaveBeenCalledWith(true);
  });

  it('shows searchable fonts found in the selected local font folder', async () => {
    const user = userEvent.setup();

    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={{
          ...localFontMirrorSettings,
          enabled: true,
          folderLabel: 'Fonts',
        }}
        localFontOptions={[
          { family: 'Acme Sans', source: 'local-font-folder' },
          { family: 'Inter Display', source: 'local-font-folder' },
          { family: 'Montserrat', source: 'local-font-folder' },
        ]}
        mirrorState={{ enabled: true, status: 'idle' }}
        onChooseLocalFontFolder={vi.fn()}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
      />,
    );

    expect(screen.getByText('Fonts found in this folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 fonts available/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /3 fonts available/i }));
    await user.type(screen.getByLabelText('Search fonts found in this folder'), 'mont');

    expect(screen.getByRole('option', { name: /Montserrat/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Acme Sans/i })).not.toBeInTheDocument();
  });

  it('disables local font mirroring without opening the folder picker', async () => {
    const user = userEvent.setup();
    const onChooseLocalFontFolder = vi.fn(() => Promise.resolve());
    const onLocalFontMirrorEnabledChange = vi.fn();

    render(
      <MirrorSettingsPanel
        config={config}
        localFontMirrorSettings={{ ...localFontMirrorSettings, enabled: true }}
        mirrorState={{ enabled: true, status: 'idle' }}
        onChooseLocalFontFolder={onChooseLocalFontFolder}
        onClose={vi.fn()}
        onEnabledChange={vi.fn()}
        onLocalFontMirrorEnabledChange={onLocalFontMirrorEnabledChange}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /Enabled/i }));

    expect(onChooseLocalFontFolder).not.toHaveBeenCalled();
    expect(onLocalFontMirrorEnabledChange).toHaveBeenCalledWith(false);
  });

  it('lets users disable mirroring from settings and keeps saving settings disabled while off', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    const onSave = vi.fn();
    const onTestConnection = vi.fn<TestConnectionHandler>(() => Promise.resolve());

    function StatefulMirrorSettingsPanel() {
      const [enabled, setEnabled] = useState(true);
      return (
        <MirrorSettingsPanel
          config={config}
          localFontMirrorSettings={localFontMirrorSettings}
          mirrorDisabledBySettings={!enabled}
          mirrorState={{ enabled, status: enabled ? 'idle' : 'disabled' }}
          onChooseLocalFontFolder={vi.fn()}
          onClose={vi.fn()}
          onEnabledChange={(nextEnabled) => {
            setEnabled(nextEnabled);
            onEnabledChange(nextEnabled, config);
          }}
          onLocalFontMirrorEnabledChange={vi.fn()}
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

    expect(onEnabledChange).toHaveBeenCalledWith(false, config);
    expect(screen.getByRole('button', { name: 'Enable mirroring' })).toHaveClass(
      'mirror-settings-toggle-success',
    );
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Enable mirroring' }));

    expect(onEnabledChange).toHaveBeenLastCalledWith(true, config);
    expect(onTestConnection).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(onTestConnection.mock.calls.at(-1)?.[0]).toEqual(config);
    expect(await screen.findByText('S3-compatible connection is ready.')).toBeInTheDocument();
  });
});
