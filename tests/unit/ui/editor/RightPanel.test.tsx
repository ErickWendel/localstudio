import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { RightPanel } from '../../../../src/ui/editor/RightPanel';

const modelStates = [
  {
    id: 'background-remover',
    label: 'Background Remover',
    provider: 'transformers' as const,
    status: 'downloading' as const,
    progress: 42,
    required: true,
  },
  {
    id: 'smart-crop',
    label: 'Smart Crop',
    provider: 'transformers' as const,
    status: 'ready' as const,
    progress: 100,
    required: true,
  },
  {
    id: 'magic-eraser',
    label: 'Magic Eraser',
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
    expect(screen.getByText('5 layers on current page')).toBeInTheDocument();
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
    expect(screen.getByText('Background Remover')).toBeInTheDocument();
    expect(screen.getByText('Magic Eraser')).toBeInTheDocument();
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
    const backgroundRow = screen.getByRole('button', { name: 'Background Shape' });
    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      getData: vi.fn(() => 'text-title'),
      setData: vi.fn(),
    };
    fireEvent.dragStart(titleRow, { dataTransfer });
    fireEvent.drop(backgroundRow, { dataTransfer });

    expect(onReorderElement).toHaveBeenCalledWith('text-title', 'shape-bg');
  });
});
