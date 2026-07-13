import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { RightPanel } from '../../../../src/ui/editor/panels/RightPanel';

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
  const project = sampleProject.createSampleProject();

  function createMediaProject(): ProjectDocument {
    const mediaProject = sampleProject.createSampleProject();
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
      trimEndSeconds: 12,
      durationSeconds: 12,
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

  it('switches between Layout, Design, and AI Tools tabs', () => {
    let activeTab: 'layout' | 'design' | 'ai-tools' = 'layout';
    const onTabChange = vi.fn((tab: 'layout' | 'design' | 'ai-tools') => {
      activeTab = tab;
    });

    render(
      <RightPanel
        activeTab={activeTab}
        onTabChange={onTabChange}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
      />,
    );

    fireEvent.click(screen.getByText('Design'));
    expect(onTabChange).toHaveBeenCalledWith('design');
    fireEvent.click(screen.getByText('AI Tools'));
    expect(onTabChange).toHaveBeenCalledWith('ai-tools');
  });

  it('exposes layer selection, controls, and drag order', () => {
    const onSelectElement = vi.fn();
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
        onSelectElement={onSelectElement}
        onSetElementVisibility={onSetVisibility}
        onSetElementLock={onSetLock}
        onDeleteElement={onDeleteElement}
        onReorderElement={onReorderElement}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onSelectElement).toHaveBeenCalledWith('text-title');

    fireEvent.click(screen.getByRole('button', { name: 'Title' }), { shiftKey: true });
    expect(onSelectElement).toHaveBeenCalledWith('text-title', { additive: true });

    fireEvent.click(screen.getByRole('button', { name: 'Hide Selected Image' }));
    expect(onSetVisibility).toHaveBeenCalledWith('image-hero', false);

    fireEvent.click(screen.getByRole('button', { name: 'Lock Selected Image' }));
    expect(onSetLock).toHaveBeenCalledWith('image-hero', true);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected Image' }));
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

  it('highlights model downloads only while they are needed', () => {
    const { rerender } = render(
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

    rerender(
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

  it('updates selected text design properties and page background', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Align selected text left' }));
    expect(onUpdateElementStyle).toHaveBeenCalledWith('text-title', { align: 'left' });
  });

  it('shows video playback settings for selected videos', () => {
    const onAlignSelectedElement = vi.fn();
    const onSetElementLock = vi.fn();
    const onSetSelectedElementZOrder = vi.fn();
    const onUpdateElementFrame = vi.fn();
    const onUpdateElementStyle = vi.fn();
    const onUpdateMediaPlayback = vi.fn();
    const onReplaceVideoAsset = vi.fn();
    const onSetElementAnimationBuilds = vi.fn();

    render(
      <RightPanel
        activeTab="design"
        onTabChange={vi.fn()}
        project={createMediaProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
        modelStates={modelStates}
        onAlignSelectedElement={onAlignSelectedElement}
        onSetElementLock={onSetElementLock}
        onSetSelectedElementZOrder={onSetSelectedElementZOrder}
        onUpdateElementFrame={onUpdateElementFrame}
        onUpdateElementStyle={onUpdateElementStyle}
        onUpdateMediaPlayback={onUpdateMediaPlayback}
        onReplaceVideoAsset={onReplaceVideoAsset}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('File Info')).toBeInTheDocument();
    expect(screen.getByText('Demo clip')).toBeInTheDocument();
    expect(screen.getByLabelText('Selected video repeat mode')).toHaveValue('none');
    expect(screen.getByLabelText('Selected video volume')).toHaveValue('100');
    const replacement = new File(['video'], 'replacement.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Replace video file'), {
      target: { files: [replacement] },
    });
    expect(onReplaceVideoAsset).toHaveBeenCalledWith('video-demo', replacement);

    fireEvent.click(screen.getByRole('button', { name: 'Play movie' }));
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', { playing: true });

    fireEvent.click(screen.getByRole('button', { name: 'Jump movie to end' }));
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', {
      playbackPositionSeconds: 12,
      playing: false,
    });

    fireEvent.change(screen.getByLabelText('Selected video repeat mode'), {
      target: { value: 'loop' },
    });
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', {
      loop: true,
      repeatMode: 'loop',
    });

    fireEvent.change(screen.getByLabelText('Selected video start'), {
      target: { value: 'after-previous' },
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['video-demo'], {
      effect: 'reveal',
      trigger: 'after-previous',
      delayMs: 0,
      durationMs: 0,
      mediaAction: 'play',
    });
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', {
      autoplayInPreview: true,
      startOnClick: false,
    });

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

    fireEvent.change(screen.getByLabelText('Selected video poster frame'), {
      target: { value: '3.5' },
    });
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', { posterFrameSeconds: 3.5 });

    fireEvent.click(screen.getByRole('tab', { name: 'Style' }));
    fireEvent.change(screen.getByLabelText('Selected element opacity'), {
      target: { value: '48' },
    });
    expect(onUpdateElementStyle).toHaveBeenCalledWith('video-demo', { opacity: 0.48 });

    fireEvent.click(screen.getByRole('tab', { name: 'Arrange' }));
    fireEvent.click(screen.getByRole('button', { name: /Front/ }));
    expect(onSetSelectedElementZOrder).toHaveBeenCalledWith('front');
    fireEvent.change(screen.getByLabelText('Align selected element'), {
      target: { value: 'page-center' },
    });
    expect(onAlignSelectedElement).toHaveBeenCalledWith('page-center');
    fireEvent.change(screen.getByLabelText('Selected element width'), { target: { value: '800' } });
    expect(onUpdateElementFrame).toHaveBeenCalledWith('video-demo', { width: 800 });
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    expect(onSetElementLock).toHaveBeenCalledWith('video-demo', true);
  });

  it('reflects the movie start animation build in the video design settings', () => {
    const mediaProject = createMediaProject();
    const videoElement = mediaProject.elements['video-demo'];
    if (videoElement?.type !== 'video') throw new Error('Expected video fixture.');
    mediaProject.elements['video-demo'] = {
      ...videoElement,
      startOnClick: true,
    };
    mediaProject.pages[0]!.animationBuilds = [
      {
        id: 'video-start',
        elementId: 'video-demo',
        effect: 'reveal',
        trigger: 'after-previous',
        delayMs: 0,
        durationMs: 0,
        mediaAction: 'play',
      },
    ];

    render(
      <RightPanel
        activeTab="design"
        onTabChange={vi.fn()}
        project={mediaProject}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
        modelStates={modelStates}
      />,
    );

    expect(screen.getByLabelText('Selected video start')).toHaveValue('after-previous');
  });

  it('shows movie controls for selected GIF objects', () => {
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

    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Play selected GIF')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Play selected GIF'));
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('gif-demo', { playing: false });
    expect(screen.queryByLabelText('Selected video trim start')).not.toBeInTheDocument();
  });
});
