import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { LeftToolPanel } from '../../../../src/ui/editor/panels/LeftToolPanel';
import { leftToolPanelTestFixtures } from './LeftToolPanel.fixtures';

const { createStockImages, modelStates, stockGif, stockImage } = leftToolPanelTestFixtures;

describe('LeftToolPanel elements and stock media controls', () => {
  it('opens the Elements menu and inserts a selected shape', async () => {
    const user = userEvent.setup();
    const onInsertShape = vi.fn();

    render(
      <LeftToolPanel
        activeTab="elements"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        onInsertShape={onInsertShape}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Elements' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Add circle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add arrow' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add triangle' }));

    expect(onInsertShape).toHaveBeenCalledWith('triangle');
  });

  it('scrolls the shape strip from the Shapes see all action', async () => {
    const user = userEvent.setup();
    const scrollBy = vi.fn();
    const originalScrollByDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollBy',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });

    try {
      render(
        <LeftToolPanel
          activeTab="elements"
          open
          onTabChange={vi.fn()}
          project={sampleProject.createSampleProject()}
          activePageId="page-1"
          selection={{ pageId: 'page-1', elementIds: [] }}
          modelStates={modelStates}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'See all Shapes' }));

      const firstScrollCall = scrollBy.mock.calls.at(0) as [ScrollToOptions] | undefined;
      const scrollOptions = firstScrollCall?.[0];
      expect(scrollOptions).toMatchObject({ behavior: 'smooth' });
      expect(typeof scrollOptions?.left).toBe('number');
    } finally {
      if (originalScrollByDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollBy', originalScrollByDescriptor);
      }
    }
  });

  it('shows configure actions when stock media providers are missing keys', () => {
    const onConfigureStockMedia = vi.fn();

    render(
      <LeftToolPanel
        activeTab="elements"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        stockMediaProviderState={{
          gifs: { configured: false, provider: 'giphy' },
          images: { configured: false, provider: 'unsplash' },
        }}
        onConfigureStockMedia={onConfigureStockMedia}
      />,
    );

    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('GIFs')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Configure media integrations' })).toHaveLength(
      2,
    );
  });

  it('shows media settings action when a configured provider search fails', async () => {
    const user = userEvent.setup();
    const onConfigureStockMedia = vi.fn();

    render(
      <LeftToolPanel
        activeTab="elements"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        stockMediaError={{ images: 'API Key is invalid' }}
        stockMediaProviderState={{
          gifs: { configured: true, provider: 'giphy' },
          images: { configured: true, provider: 'unsplash' },
        }}
        onConfigureStockMedia={onConfigureStockMedia}
      />,
    );

    expect(screen.getByText('API Key is invalid')).toBeInTheDocument();
    expect(screen.queryByText('No images found.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configure media integrations' }));

    expect(onConfigureStockMedia).toHaveBeenCalledTimes(1);
  });

  it('searches and inserts configured stock media results', async () => {
    const user = userEvent.setup();
    const onSearchStockImages = vi.fn();
    const onSearchStockGifs = vi.fn();
    const onInsertStockMedia = vi.fn();

    render(
      <LeftToolPanel
        activeTab="elements"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        stockImageResults={[stockImage]}
        stockGifResults={[stockGif]}
        stockMediaProviderState={{
          gifs: { configured: true, provider: 'giphy' },
          images: { configured: true, provider: 'unsplash' },
        }}
        onInsertStockMedia={onInsertStockMedia}
        onSearchStockGifs={onSearchStockGifs}
        onSearchStockImages={onSearchStockImages}
      />,
    );

    expect(screen.getByPlaceholderText('search images')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('search gifs')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search Unsplash images'), 'mountain{Enter}');
    await user.type(screen.getByLabelText('Search GIPHY GIFs'), 'launch{Enter}');
    await user.click(screen.getByRole('button', { name: 'Insert image by Ada Photo' }));
    await user.click(screen.getByRole('button', { name: 'Insert GIF Launch GIF' }));

    expect(onSearchStockImages).toHaveBeenCalledWith('mountain');
    expect(onSearchStockGifs).toHaveBeenCalledWith('launch');
    expect(onInsertStockMedia).toHaveBeenCalledWith(stockImage);
    expect(onInsertStockMedia).toHaveBeenCalledWith(stockGif);
  });

  it('paginates stock media results in groups of ten', async () => {
    const user = userEvent.setup();

    render(
      <LeftToolPanel
        activeTab="elements"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        stockImageResults={createStockImages(12)}
        stockMediaProviderState={{
          gifs: { configured: false, provider: 'giphy' },
          images: { configured: true, provider: 'unsplash' },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Insert image by Photo Author 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert image by Photo Author 10' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Insert image by Photo Author 11' })).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next Images page' }));

    expect(screen.queryByRole('button', { name: 'Insert image by Photo Author 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert image by Photo Author 11' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert image by Photo Author 12' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });
});
