import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  InvalidImageStockMediaService,
  ReadyStockMediaService,
  createAppServices,
  mockVideoMetadataLoad,
  openLeftTab,
  stockImage,
} = editorShellTestHarness;

describe('EditorShell elements and stock media workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('inserts and selects a shape from the Elements panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Add triangle' }));

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
    await user.click(await screen.findByRole('button', { name: 'Insert image by Ada Photo' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-/),
      );
    });
    expect(stockMediaService.trackedItems).toEqual([stockImage]);
  });

  it('inserts and selects a GIPHY GIF movie from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    mockVideoMetadataLoad();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    await user.click(await screen.findByRole('button', { name: 'Insert GIF Launch GIF' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^video-/),
      );
    });
    expect(screen.getByLabelText('Launch GIF').tagName.toLowerCase()).toBe('video');
    expect(screen.getByLabelText('Launch GIF')).toHaveAttribute(
      'src',
      'https://media.giphy.com/media/gif-1/giphy.mp4',
    );
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

    await user.click(screen.getByRole('button', { name: 'Configure media integrations' }));

    expect(screen.getByRole('dialog', { name: 'Media integrations' })).toBeInTheDocument();
  });

  it('keeps the Animations panel open after media integration settings are saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Animate');
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Media integrations',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save media integrations' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Media integrations' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');
  });
});
