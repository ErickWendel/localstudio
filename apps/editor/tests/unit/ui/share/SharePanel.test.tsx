import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareMetadata } from '../../../../src/services/contracts/interfaces';
import { SharePanel } from '../../../../src/ui/share/SharePanel';

function createShareMetadata(overrides: Partial<ShareMetadata> = {}): ShareMetadata {
  return {
    shareId: 'share-panel-id',
    publicUrl: 'https://localstudio.test/s/share-panel-id',
    embedUrl: 'https://localstudio.test/embed/share-panel-id',
    embedHtml: '<iframe src="https://localstudio.test/embed/share-panel-id"></iframe>',
    createdAt: '2026-06-30T12:00:00.000Z',
    updatedAt: '2026-06-30T12:00:00.000Z',
    status: 'published',
    ...overrides,
  };
}

describe('SharePanel', () => {
  const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (execCommandDescriptor) {
      Object.defineProperty(document, 'execCommand', execCommandDescriptor);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('shows the not shared state before publishing', () => {
    render(
      <SharePanel
        projectName="Untitled AI Deck"
        onClose={vi.fn()}
        onCopyLink={vi.fn()}
        onDownload={vi.fn()}
        onPresent={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Share design' })).toBeInTheDocument();
    expect(screen.getByText('Not shared yet')).toBeInTheDocument();
    expect(screen.getByText(/Public links should use a read-only storage key/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Public view link' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Embed code' })).toBeDisabled();
  });

  it('disables only public link creation when remote storage is unavailable', async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    const onDownload = vi.fn();
    const onPresent = vi.fn();
    const onConfigurePublicLink = vi.fn();
    const message = 'Public links cannot be created without remote storage.';

    render(
      <SharePanel
        projectName="Untitled AI Deck"
        publicLinkUnavailableReason={message}
        onClose={vi.fn()}
        onConfigurePublicLink={onConfigurePublicLink}
        onCopyLink={onCopyLink}
        onDownload={onDownload}
        onPresent={onPresent}
      />,
    );

    expect(screen.getByText(message)).toBeInTheDocument();
    const configureButton = screen.getByRole('button', { name: 'Configure mirror storage' });
    expect(configureButton).toBeEnabled();
    expect(configureButton).toHaveAttribute('title', message);
    expect(configureButton).toHaveAttribute('data-loading', 'false');

    await user.click(configureButton);
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(screen.getByRole('button', { name: 'Present' }));

    expect(onCopyLink).not.toHaveBeenCalled();
    expect(onConfigurePublicLink).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onPresent).toHaveBeenCalledTimes(1);
  });

  it('creates a share and copies the public URL', async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn().mockResolvedValue(createShareMetadata({ status: 'copied' }));

    render(
      <SharePanel
        projectName="Untitled AI Deck"
        onClose={vi.fn()}
        onCopyLink={onCopyLink}
        onDownload={vi.fn()}
        onPresent={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() => {
      expect(onCopyLink).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByDisplayValue('https://localstudio.test/s/share-panel-id')).toBeInTheDocument();
    expect(screen.getByDisplayValue('<iframe src="https://localstudio.test/embed/share-panel-id"></iframe>')).toBeInTheDocument();
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('copies embed code without the Clipboard permissions API', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    render(
      <SharePanel
        projectName="Untitled AI Deck"
        share={createShareMetadata()}
        onClose={vi.fn()}
        onCopyLink={vi.fn()}
        onDownload={vi.fn()}
        onPresent={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Embed code' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('shows an error when share publishing fails', async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn().mockRejectedValue(new Error('Could not upload share.json'));

    render(
      <SharePanel
        projectName="Untitled AI Deck"
        onClose={vi.fn()}
        onCopyLink={onCopyLink}
        onDownload={vi.fn()}
        onPresent={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Share failed')).toBeInTheDocument();
    expect(screen.getByText('Could not upload share.json')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).not.toBeDisabled();
  });

  it('runs download and present actions', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onPresent = vi.fn();

    render(
      <SharePanel
        projectName="Untitled AI Deck"
        share={createShareMetadata()}
        onClose={vi.fn()}
        onCopyLink={vi.fn()}
        onDownload={onDownload}
        onPresent={onPresent}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(screen.getByRole('button', { name: 'Present' }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onPresent).toHaveBeenCalledTimes(1);
  });

  it('opens the public view link after publishing', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    render(
      <SharePanel
        projectName="Untitled AI Deck"
        share={createShareMetadata()}
        onClose={vi.fn()}
        onCopyLink={vi.fn()}
        onDownload={vi.fn()}
        onPresent={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Public view link' }));

    expect(open).toHaveBeenCalledWith('https://localstudio.test/s/share-panel-id', '_blank', 'noopener,noreferrer');
  });
});
