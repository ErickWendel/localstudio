import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { LeftToolPanel } from '../../../../src/ui/editor/LeftToolPanel';
import type { RightPanelTab } from '../../../../src/ui/editor/useEditorViewModel';

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
          project={createSampleProject()}
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
        project={createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        onImportMedia={onImportMedia}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    await user.upload(screen.getByLabelText('Import media file'), file);

    expect(onImportMedia).toHaveBeenCalledWith(file);
  });

  it('lists project assets with usage status and removal controls', async () => {
    const project = createSampleProject();
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
        project={createSampleProject()}
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

  it('opens the Elements menu and inserts a selected shape', async () => {
    const user = userEvent.setup();
    const onInsertShape = vi.fn();

    render(
      <LeftToolPanel
        activeTab="elements"
        open
        onTabChange={vi.fn()}
        project={createSampleProject()}
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
});
