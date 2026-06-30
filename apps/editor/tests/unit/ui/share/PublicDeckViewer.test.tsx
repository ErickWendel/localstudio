import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { BrowserShareService } from '../../../../src/services/shareService';
import { PublicDeckViewer } from '../../../../src/ui/share/PublicDeckViewer';

describe('PublicDeckViewer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000201');
  });

  it('renders a shared deck in read-only mode', async () => {
    const shareService = new BrowserShareService({ origin: 'https://localstudio.test' });
    const share = await shareService.createShare(createSampleProject());

    render(<PublicDeckViewer shareId={share.shareId} shareService={shareService} />);

    expect(await screen.findByLabelText('Public presentation')).toHaveClass('public-deck-viewer-present');
    expect(screen.queryByRole('heading', { name: 'Untitled AI Deck' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('keeps embeds in a compact shared deck layout', async () => {
    const shareService = new BrowserShareService({ origin: 'https://localstudio.test' });
    const share = await shareService.createShare(createSampleProject());

    render(<PublicDeckViewer shareId={share.shareId} shareService={shareService} embed />);

    expect(await screen.findByLabelText('Embedded shared deck')).toHaveClass('public-deck-viewer-embed');
    expect(screen.getByLabelText('Embedded shared deck')).not.toHaveClass('public-deck-viewer-present');
  });

  it('moves between slides with next and previous controls', async () => {
    const user = userEvent.setup();
    const shareService = new BrowserShareService({ origin: 'https://localstudio.test' });
    const project = createSampleProject();
    project.pages.push({
      id: 'page-2',
      name: 'Slide 2',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#111111' },
      elementIds: [],
    });
    const share = await shareService.createShare(project);

    render(<PublicDeckViewer shareId={share.shareId} shareService={shareService} />);

    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('shows a not found state for missing shares', async () => {
    const shareService = new BrowserShareService({ origin: 'https://localstudio.test' });

    render(<PublicDeckViewer shareId="missing-share" shareService={shareService} />);

    expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument();
  });
});
