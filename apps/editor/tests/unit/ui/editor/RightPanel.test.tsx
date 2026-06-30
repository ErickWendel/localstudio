import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import type { ProjectDocument } from '../../../../src/domain/model';
import { RightPanel } from '../../../../src/ui/editor/RightPanel';

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

describe('RightPanel', () => {
  const project = createSampleProject();

  function createMediaProject(): ProjectDocument {
    const mediaProject = createSampleProject();
    mediaProject.assets['asset-video'] = {
      id: 'asset-video',
      type: 'video',
      name: 'Demo clip',
      mimeType: 'video/mp4',
      objectUrl: 'blob:video',
    };
    mediaProject.assets['asset-gif'] = {
      id: 'asset-gif',
      type: 'gif',
      name: 'Animated loop',
      mimeType: 'image/gif',
      objectUrl: 'blob:gif',
    };
    mediaProject.elements['video-demo'] = {
      id: 'video-demo',
      type: 'video',
      assetId: 'asset-video',
      x: 0,
      y: 0,
      width: 640,
      height: 360,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      loop: false,
      controls: false,
      muted: false,
      autoplayInPreview: false,
      trimStartSeconds: 0,
      trimEndSeconds: 0,
    };
    mediaProject.elements['gif-demo'] = {
      id: 'gif-demo',
      type: 'gif',
      assetId: 'asset-gif',
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      playing: true,
    };
    mediaProject.pages[0]?.elementIds.push('video-demo', 'gif-demo');
    return mediaProject;
  }

  it('switches between Layout, Design, and AI Tools tabs', async () => {
    const user = userEvent.setup();
    let activeTab: 'layout' | 'design' | 'ai-tools' = 'layout';
    const onTabChange = vi.fn((tab: 'layout' | 'design' | 'ai-tools') => {
      activeTab = tab;
    });

    const { rerender } = render(
      <RightPanel
        activeTab={activeTab}
        onTabChange={onTabChange}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('4 layers on current page')).toBeInTheDocument();
    expect(screen.getByText('Selected Image')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    rerender(
      <RightPanel
        activeTab="design"
        onTabChange={onTabChange}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
      />,
    );
    expect(screen.getByText('1920 x 1080')).toBeInTheDocument();
    expect(screen.getByLabelText('Canvas background color')).toHaveValue('#050d10');
    expect(screen.queryByText('Text-to-Palette')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    rerender(
      <RightPanel
        activeTab="ai-tools"
        onTabChange={onTabChange}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
      />,
    );
    expect(screen.queryByText('Download Required Models')).not.toBeInTheDocument();
    expect(screen.queryByText('Local Chrome AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Cached Browser Models')).not.toBeInTheDocument();
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
    expect(screen.queryByText('Models')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('LLM Model').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('Translation Model').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
    expect(screen.getByText('Segmentation model for image editing.')).toBeInTheDocument();
    expect(screen.queryByText('Background Remover')).not.toBeInTheDocument();
    expect(screen.queryByText('Magic Eraser')).not.toBeInTheDocument();
  });

  it('selects the matching canvas element from a layout row', async () => {
    const user = userEvent.setup();
    const onSelectElement = vi.fn();

    render(
      <RightPanel
        activeTab="layout"
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        onSelectElement={onSelectElement}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Title' }));

    expect(onSelectElement).toHaveBeenCalledWith('text-title');
  });

  it('adds to selection from a layout row with shift click', async () => {
    const user = userEvent.setup();
    const onSelectElement = vi.fn();

    render(
      <RightPanel
        activeTab="layout"
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        onSelectElement={onSelectElement}
      />,
    );

    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: 'Title' }));
    await user.keyboard('{/Shift}');

    expect(onSelectElement).toHaveBeenCalledWith('text-title', { additive: true });
  });

  it('highlights the image editing model download when background selection needs it', () => {
    render(
      <RightPanel
        activeTab="ai-tools"
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        attentionModelId="image-editing-models"
      />,
    );

    expect(screen.getByRole('article', { name: 'Image Editing Models' })).toHaveClass('model-row-attention');
    expect(screen.getByRole('button', { name: 'Download Image Editing Models' })).toHaveClass(
      'icon-button-attention',
    );
  });

  it('does not pulse a ready image editing model', () => {
    render(
      <RightPanel
        activeTab="ai-tools"
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={[{ ...modelStates[0]!, status: 'ready' as const, progress: 100 }]}
        attentionModelId="image-editing-models"
      />,
    );

    expect(screen.getByRole('article', { name: 'Image Editing Models' })).not.toHaveClass('model-row-attention');
    expect(screen.queryByRole('button', { name: 'Download Image Editing Models' })).not.toBeInTheDocument();
  });

  it('exposes layer controls for visibility, lock, delete, and drag order', async () => {
    const user = userEvent.setup();
    const onSetVisibility = vi.fn();
    const onSetLock = vi.fn();
    const onDeleteElement = vi.fn();
    const onReorderElement = vi.fn();

    render(
      <RightPanel
        activeTab="layout"
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        onSetElementVisibility={onSetVisibility}
        onSetElementLock={onSetLock}
        onDeleteElement={onDeleteElement}
        onReorderElement={onReorderElement}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Hide Selected Image' }));
    expect(onSetVisibility).toHaveBeenCalledWith('image-hero', false);

    await user.click(screen.getByRole('button', { name: 'Lock Selected Image' }));
    expect(onSetLock).toHaveBeenCalledWith('image-hero', true);

    await user.click(screen.getByRole('button', { name: 'Delete Selected Image' }));
    expect(onDeleteElement).toHaveBeenCalledWith('image-hero');

    const titleRow = screen.getByRole('button', { name: 'Title' });
    const subtitleRow = screen.getByRole('button', { name: 'Subtitle' });
    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      getData: vi.fn(() => 'text-title'),
      setData: vi.fn(),
    };
    vi.spyOn(subtitleRow, 'getBoundingClientRect').mockReturnValue({
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
    fireEvent.dragStart(titleRow, { dataTransfer });
    fireEvent.dragOver(subtitleRow, { dataTransfer, clientY: 39 });
    expect(subtitleRow).toHaveAttribute('data-drop-position', 'after');
    fireEvent.drop(subtitleRow, { dataTransfer, clientY: 39 });

    expect(onReorderElement).toHaveBeenCalledWith('text-title', 'text-subtitle', 'after');
  });

  it('updates selected text design properties and page background', async () => {
    const user = userEvent.setup();
    const onUpdateElementStyle = vi.fn();
    const onUpdatePageBackground = vi.fn();

    render(
      <RightPanel
        activeTab="design"
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        modelStates={modelStates}
        onUpdateElementStyle={onUpdateElementStyle}
        onUpdatePageBackground={onUpdatePageBackground}
      />,
    );

    fireEvent.change(screen.getByLabelText('Canvas background color'), {
      target: { value: '#000000' },
    });
    expect(onUpdatePageBackground).toHaveBeenCalledWith({ type: 'color', color: '#000000' });

    fireEvent.change(screen.getByLabelText('Selected text color'), {
      target: { value: '#ffffff' },
    });
    expect(onUpdateElementStyle).toHaveBeenCalledWith('text-title', { fill: '#ffffff' });

    await user.selectOptions(screen.getByLabelText('Selected text alignment'), 'left');
    expect(onUpdateElementStyle).toHaveBeenCalledWith('text-title', { align: 'left' });
  });

  it('shows video playback settings for selected videos', async () => {
    const user = userEvent.setup();
    const onUpdateMediaPlayback = vi.fn();

    render(
      <RightPanel
        activeTab="design"
        onTabChange={vi.fn()}
        project={createMediaProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
        modelStates={modelStates}
        onUpdateMediaPlayback={onUpdateMediaPlayback}
      />,
    );

    expect(screen.getByText('Playback')).toBeInTheDocument();
    expect(screen.getByLabelText('Loop selected video')).not.toBeChecked();
    expect(screen.getByLabelText('Show selected video controls')).not.toBeChecked();
    expect(screen.getByLabelText('Mute selected video')).not.toBeChecked();
    expect(screen.getByLabelText('Autoplay selected video in preview')).not.toBeChecked();

    await user.click(screen.getByLabelText('Loop selected video'));
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', { loop: true });

    expect(screen.getByLabelText('Selected video trim start')).toHaveAttribute('type', 'range');
    expect(screen.getByLabelText('Selected video trim end')).toHaveAttribute('type', 'range');

    fireEvent.change(screen.getByLabelText('Selected video trim start'), {
      target: { value: '1.5' },
    });
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', { trimStartSeconds: 1.5 });

    fireEvent.change(screen.getByLabelText('Selected video trim end'), {
      target: { value: '9.5' },
    });
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', { trimEndSeconds: 9.5 });
  });

  it('does not show playback controls for selected GIF objects', () => {
    const onUpdateMediaPlayback = vi.fn();

    render(
      <RightPanel
        activeTab="design"
        onTabChange={vi.fn()}
        project={createMediaProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['gif-demo'] }}
        modelStates={modelStates}
        onUpdateMediaPlayback={onUpdateMediaPlayback}
      />,
    );

    expect(screen.queryByText('GIF Playback')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Play selected GIF')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected video trim start')).not.toBeInTheDocument();
    expect(onUpdateMediaPlayback).not.toHaveBeenCalled();
  });
});
