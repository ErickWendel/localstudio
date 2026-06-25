import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
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
    expect(screen.getByText('16:9 Presentation')).toBeInTheDocument();
    expect(screen.getByText('Text-to-Palette')).toBeInTheDocument();
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
    expect(screen.getByText('Download Required Models')).toBeInTheDocument();
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
    fireEvent.dragStart(titleRow, { dataTransfer });
    fireEvent.drop(subtitleRow, { dataTransfer });

    expect(onReorderElement).toHaveBeenCalledWith('text-title', 'text-subtitle');
  });
});
