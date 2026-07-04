import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { StockMediaItem } from '../../../../src/services/contracts/interfaces';
import { LeftToolPanel } from '../../../../src/ui/editor/panels/LeftToolPanel';
import type { RightPanelTab } from '../../../../src/ui/editor/state/useEditorViewModel';

const modelStates = [
  {
    id: 'image-editing-models',
    label: 'Image Editing Models',
    description: 'Segmentation model for image editing.',
    provider: 'transformers' as const,
    status: 'needs-download' as const,
    progress: 0,
    required: true,
  },
];

const stockImage: StockMediaItem = {
  id: 'photo-1',
  provider: 'unsplash',
  kind: 'image',
  title: 'Mountain sunset',
  authorName: 'Ada Photo',
  thumbnailUrl: 'https://images.unsplash.com/photo-1?w=400',
  mediaUrl: 'https://images.unsplash.com/photo-1?w=1080',
  width: 1200,
  height: 800,
  downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
};

const stockGif: StockMediaItem = {
  id: 'gif-1',
  provider: 'giphy',
  kind: 'gif',
  title: 'Launch GIF',
  authorName: 'Motion Studio',
  thumbnailUrl: 'https://media.giphy.com/media/gif-1/200w.gif',
  mediaUrl: 'https://media.giphy.com/media/gif-1/giphy.gif',
  width: 480,
  height: 270,
};

function createStockImages(count: number): StockMediaItem[] {
  return Array.from({ length: count }, (_, index) => {
    const itemNumber = index + 1;
    return {
      id: `photo-${itemNumber}`,
      provider: 'unsplash',
      kind: 'image',
      title: `Mountain sunset ${itemNumber}`,
      authorName: `Photo Author ${itemNumber}`,
      thumbnailUrl: `https://images.unsplash.com/photo-${itemNumber}?w=400`,
      mediaUrl: `https://images.unsplash.com/photo-${itemNumber}?w=1080`,
      width: 1200,
      height: 800,
      downloadLocation: `https://api.unsplash.com/photos/photo-${itemNumber}/download`,
    };
  });
}

describe('LeftToolPanel', () => {
  it('opens panel content on click and closes it when clicking the active item again', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    function Harness() {
      const [activeTab, setActiveTab] = useState<RightPanelTab>('layout');
      const [open, setOpen] = useState(false);
      return (
        <LeftToolPanel
          activeTab={activeTab}
          open={open}
          onTabChange={(tab) => {
            onTabChange(tab);
            setActiveTab(tab);
          }}
          onOpenChange={setOpen}
          project={sampleProject.createSampleProject()}
          activePageId="page-1"
          selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
          modelStates={modelStates}
        />
      );
    }

    render(<Harness />);

    expect(screen.queryByText('4 layers on current page')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByText('4 layers on current page')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledWith('ai-tools');

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    expect(screen.queryByText('Image Editing Models')).not.toBeInTheDocument();
  });

  it('imports media files from the Assets menu', async () => {
    const user = userEvent.setup();
    const onImportMedia = vi.fn();
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    render(
      <LeftToolPanel
        activeTab="assets"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        onImportMedia={onImportMedia}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    const input = screen.getByLabelText('Import media file');
    expect(input).toHaveAttribute('accept', 'image/*,.mp4,video/mp4,.webm,video/webm');
    expect(input.getAttribute('accept')).not.toContain('video/*');
    await user.upload(input, file);

    expect(onImportMedia).toHaveBeenCalledWith(file);
  });

  it('lists project assets with usage status and removal controls', async () => {
    const project = sampleProject.createSampleProject();
    project.assets['asset-unused'] = {
      id: 'asset-unused',
      type: 'image',
      name: 'Unused Logo.png',
      mimeType: 'image/png',
      fileName: 'unused-logo.png',
      storage: 'file',
    };
    const onRemoveAsset = vi.fn();

    render(
      <LeftToolPanel
        activeTab="assets"
        open
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        onRemoveAsset={onRemoveAsset}
      />,
    );

    expect(screen.getByText('Futuristic landscape')).toBeInTheDocument();
    expect(screen.getByText('Unused Logo.png')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(screen.getByText('Unused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Unused Logo.png' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Futuristic landscape' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Unused Logo.png' }));

    expect(onRemoveAsset).toHaveBeenCalledWith('asset-unused');
  });

  it('adds styled text presets from the Text menu', async () => {
    const user = userEvent.setup();
    const onInsertText = vi.fn();

    render(
      <LeftToolPanel
        activeTab="text"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        onInsertText={onInsertText}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Text' }));
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));
    await user.click(screen.getByRole('button', { name: 'Add a subheading' }));
    await user.click(screen.getByRole('button', { name: 'Add a little bit of body text' }));

    expect(onInsertText).toHaveBeenNthCalledWith(1, 'title');
    expect(onInsertText).toHaveBeenNthCalledWith(2, 'subtitle');
    expect(onInsertText).toHaveBeenNthCalledWith(3, 'body');
  });

  it('shows slide transition and all object animations in the Animate menu', async () => {
    const user = userEvent.setup();
    const onSetPageTransition = vi.fn();
    const onClearPageTransition = vi.fn();
    const onClearElementAnimationBuild = vi.fn();
    const onReorderElementAnimationBuild = vi.fn();
    const onPlayAnimationPreview = vi.fn();
    const onSetElementAnimationBuilds = vi.fn();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      elementIds: [...project.pages[0]!.elementIds, 'shape-line'],
      transition: { effect: 'reveal', delayMs: 0 },
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
        {
          id: 'build-text-title',
          elementId: 'text-title',
          effect: 'reveal',
          trigger: 'after-transition',
          delayMs: 0,
        },
        {
          id: 'build-shape-line',
          elementId: 'shape-line',
          effect: 'line-draw',
          trigger: 'after-previous',
          delayMs: 0,
          lineDrawDirection: 'start-to-end',
        },
      ],
    };
    project.elements['shape-line'] = {
      id: 'shape-line',
      type: 'shape',
      shape: 'line',
      x: 120,
      y: 120,
      width: 500,
      height: 140,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      stroke: '#37FD76',
      strokeWidth: 8,
    };

    render(
      <LeftToolPanel
        activeTab="animations"
        animationPreview={{
          activeBuildElementId: 'text-title',
          pageId: 'page-1',
          phase: 'waiting',
          playing: true,
          waitingForClick: true,
        }}
        open
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        onClearPageTransition={onClearPageTransition}
        onClearElementAnimationBuild={onClearElementAnimationBuild}
        onSetPageTransition={onSetPageTransition}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
        onReorderElementAnimationBuild={onReorderElementAnimationBuild}
        onPlayAnimationPreview={onPlayAnimationPreview}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Animate' })).toBeInTheDocument();
    expect(screen.getByText('Slide Transition')).toBeInTheDocument();
    expect(screen.getByText('Object Animations')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('AI Design Revolution')).toBeInTheDocument();
    expect(screen.getByText('Rectangle')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 3')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Build 2: AI Design Revolution' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByLabelText('Current animation step 2')).toBeInTheDocument();

    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      getData: vi.fn(() => 'text-title'),
      setData: vi.fn(),
    };
    const titleBuildRow = screen.getByRole('listitem', { name: 'Build 2: AI Design Revolution' });
    const imageBuildRow = screen.getByRole('listitem', { name: 'Build 1: Image' });
    vi.spyOn(imageBuildRow, 'getBoundingClientRect').mockReturnValue({
      bottom: 40,
      height: 40,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.dragStart(titleBuildRow, { dataTransfer });
    fireEvent.dragOver(imageBuildRow, { dataTransfer, clientY: -1 });
    expect(imageBuildRow).toHaveAttribute('data-drop-position', 'after');
    fireEvent.drop(imageBuildRow, { dataTransfer, clientY: -1 });

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-localstudio-animation-build-element-id',
      'text-title',
    );
    expect(onReorderElementAnimationBuild).toHaveBeenCalledWith('text-title', 1);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Slide transition effect' }),
      'reveal',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Slide transition effect' }),
      'none',
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Effect for Image' }), 'none');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Effect for AI Design Revolution' }),
      'keyboard-typing',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Effect for Rectangle' }),
      'dissolve',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Effect for Rectangle' }),
      'line-draw',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Line draw direction for Rectangle' }),
      'middle-to-ends',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Start for AI Design Revolution' }),
      'after-previous',
    );
    await user.click(
      screen.getByRole('button', { name: 'Move AI Design Revolution animation up' }),
    );
    await user.click(screen.getByRole('button', { name: 'Play animation preview' }));

    expect(onSetPageTransition).toHaveBeenCalledWith({ effect: 'reveal', delayMs: 500 });
    expect(onClearPageTransition).toHaveBeenCalledTimes(1);
    expect(onClearElementAnimationBuild).toHaveBeenCalledWith('image-hero');
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title'], {
      effect: 'keyboard-typing',
      trigger: 'after-transition',
      delayMs: 0,
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['shape-line'], {
      effect: 'dissolve',
      trigger: 'after-previous',
      delayMs: 0,
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['shape-line'], {
      effect: 'line-draw',
      trigger: 'after-previous',
      delayMs: 0,
      lineDrawDirection: 'start-to-end',
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['shape-line'], {
      effect: 'line-draw',
      trigger: 'after-previous',
      delayMs: 0,
      lineDrawDirection: 'middle-to-ends',
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title'], {
      effect: 'reveal',
      trigger: 'after-previous',
      delayMs: 0,
    });
    expect(onReorderElementAnimationBuild).toHaveBeenCalledWith('text-title', 0);
    expect(onPlayAnimationPreview).toHaveBeenCalledTimes(1);
  });

  it('applies reveal to selected elements from the whole-slide animation view', async () => {
    const user = userEvent.setup();
    const onSetElementAnimationBuilds = vi.fn();
    const onPlayAnimationPreview = vi.fn();

    render(
      <LeftToolPanel
        activeTab="animations"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title', 'image-hero'] }}
        modelStates={modelStates}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
        onPlayAnimationPreview={onPlayAnimationPreview}
      />,
    );

    expect(screen.getByText('Object Animations')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add animation' }));
    await user.click(screen.getByRole('button', { name: 'Play animation preview' }));

    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title', 'image-hero'], {
      effect: 'reveal',
      trigger: 'on-click',
      delayMs: 500,
    });
    expect(onPlayAnimationPreview).toHaveBeenCalledTimes(1);
  });

  it('chooses keyboard typing before adding a selected text animation', async () => {
    const user = userEvent.setup();
    const onSetElementAnimationBuilds = vi.fn();

    render(
      <LeftToolPanel
        activeTab="animations"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        modelStates={modelStates}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
      />,
    );

    expect(screen.getByText('No object animations on this slide.')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'New object animation effect' }),
      'keyboard-typing',
    );
    await user.click(screen.getByRole('button', { name: 'Add animation' }));

    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title'], {
      effect: 'keyboard-typing',
      trigger: 'on-click',
      delayMs: 500,
    });
  });

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
