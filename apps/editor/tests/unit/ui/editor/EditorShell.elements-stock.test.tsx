import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  InvalidImageStockMediaService,
  ReadyStockMediaService,
  createAppServices,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoad,
  openLeftTab,
  stockImage,
} = editorShellTestHarness;

class PendingTrackingStockMediaService extends ReadyStockMediaService {
  override trackImageDownload(): Promise<void> {
    return new Promise(() => undefined);
  }
}

describe('EditorShell elements and stock media workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('inserts and selects a shape from the Elements panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Elements');
    fireEvent.click(screen.getByRole('button', { name: 'Add triangle' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^shape-/),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByLabelText('Selected shape fill mode')).toBeInTheDocument();

    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Background Shape' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('inserts and selects an Unsplash image from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const stockMediaService = new ReadyStockMediaService();
    services.stockMediaService = stockMediaService;

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    fireEvent.click(await screen.findByRole('button', { name: 'Insert image by Ada Photo' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-/),
      );
    });
    expect(stockMediaService.downloadedItems).toEqual([
      { item: stockImage, sourceUrl: stockImage.mediaUrl },
    ]);
    await waitFor(() => {
      expect(stockMediaService.trackedItems).toEqual([stockImage]);
    });
  });

  it('opens Elements when selecting an image placeholder and replaces it with a stock image', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const stockMediaService = new ReadyStockMediaService();
    services.stockMediaService = stockMediaService;

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Layout');
    fireEvent.click(screen.getByRole('button', { name: 'Insert 1 image grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Web AI placeholder image' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Elements' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Insert image by Ada Photo' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-grid-1-/),
      );
    });
    expect(stockMediaService.downloadedItems).toEqual([
      { item: stockImage, sourceUrl: stockImage.mediaUrl },
    ]);
  });

  it('inserts an Unsplash image before download tracking finishes', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new PendingTrackingStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    fireEvent.click(await screen.findByRole('button', { name: 'Insert image by Ada Photo' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-/),
      );
    });
  });

  it('inserts and selects a GIPHY GIF movie from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    mockVideoMetadataLoad();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    fireEvent.click(await screen.findByRole('button', { name: 'Insert GIF Launch GIF' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^video-/),
      );
    });
    expect(screen.getByLabelText('Launch GIF').tagName.toLowerCase()).toBe('video');
    expect(screen.getByLabelText('Launch GIF')).toHaveAttribute('src', 'blob:giphy-video');
  });

  it('replaces a selected image placeholder with a stock GIF movie in the same slot', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Layout');
    fireEvent.click(screen.getByRole('button', { name: 'Insert 1 image grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Web AI placeholder image' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert GIF Launch GIF' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-grid-1-/),
      );
    });
    expect(screen.getByLabelText('Launch GIF').tagName.toLowerCase()).toBe('video');
    expect(screen.getByLabelText('Launch GIF')).toHaveAttribute('src', 'blob:giphy-video');
  });

  it('inserts a GIPHY GIF movie before video metadata finishes loading', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    mockControllableVideoMetadataLoad();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    fireEvent.click(await screen.findByRole('button', { name: 'Insert GIF Launch GIF' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^video-/),
      );
    });
    expect(screen.getByLabelText('Launch GIF')).toHaveAttribute('src', 'blob:giphy-video');
  });

  it('shows a generic API key error when stock image search is rejected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new InvalidImageStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');

    expect(await screen.findByText('API Key is invalid')).toBeInTheDocument();
    expect(
      screen.queryByText('Unsplash image search failed with 401 Unauthorized.'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Configure media integrations' }));

    expect(screen.getByRole('dialog', { name: 'Media integrations' })).toBeInTheDocument();
  });

  it('keeps the Animations panel open after media integration settings are saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Animate');
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Media integrations',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save media integrations' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Media integrations' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');
  });
});
