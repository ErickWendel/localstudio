import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { LeftToolPanel } from '../../../../src/ui/editor/panels/LeftToolPanel';
import type { RightPanelTab } from '../../../../src/ui/editor/state/useEditorViewModel';
import { leftToolPanelTestFixtures } from './LeftToolPanel.fixtures';

const { modelStates } = leftToolPanelTestFixtures;

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

  it('renders the layout panel without a slide selection handler', async () => {
    const user = userEvent.setup();

    render(
      <LeftToolPanel
        activeTab="layout"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Page Background' }));

    expect(screen.getByRole('button', { name: 'Page Background' })).toBeInTheDocument();
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
    expect(input).toHaveAttribute('accept', 'image/*,video/*');
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

    expect(screen.getByRole('button', { name: /^Media/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Futuristic landscape')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Media/ }));

    expect(screen.getByRole('separator', { name: 'Unused media' })).toBeInTheDocument();
    expect(screen.getByText('Unused Logo.png').compareDocumentPosition(screen.getByText('Futuristic landscape'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(screen.getByText('Unused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Unused Logo.png' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove Futuristic landscape' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open Futuristic landscape in a new tab' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.queryByRole('link', { name: 'Open Unused Logo.png in a new tab' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Unused Logo.png' }));

    expect(onRemoveAsset).toHaveBeenCalledWith('asset-unused');
  });

  it('lists recording and transcript sub-items that can be opened or deleted', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.recordings = {
      'recording-1': {
        id: 'recording-1',
        name: 'Launch talk',
        createdAt: '2026-09-19T12:00:00.000Z',
        updatedAt: '2026-09-19T12:00:00.000Z',
        durationMs: 65_000,
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm',
          fileName: 'launch.webm',
          objectUrl: 'blob:https://localstudio.test/launch',
          storage: 'file',
        },
        transcriptFileName: 'recording-1.transcript.json',
        segments: [
          { id: 'segment-1', text: 'Hello', startMs: 0, endMs: 1_000, pageId: 'page-1', final: true },
        ],
      },
      'recording-unsafe': {
        id: 'recording-unsafe',
        name: 'Unsafe talk',
        createdAt: '2026-09-18T12:00:00.000Z',
        updatedAt: '2026-09-18T12:00:00.000Z',
        durationMs: 1_000,
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm',
          objectUrl: 'javascript:alert(1)',
        },
        segments: [],
      },
    };
    const onRemoveRecording = vi.fn();
    const onRemoveRecordingAudio = vi.fn();
    const onRemoveTranscript = vi.fn();
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:https://localstudio.test/transcript');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    render(
      <LeftToolPanel
        activeTab="assets"
        open
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        modelStates={modelStates}
        onRemoveRecording={onRemoveRecording}
        onRemoveRecordingAudio={onRemoveRecordingAudio}
        onRemoveTranscript={onRemoveTranscript}
      />,
    );

    expect(screen.getByRole('button', { name: /^Recordings/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Launch talk')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Recordings/ }));
    expect(screen.queryByRole('link', { name: 'Open Launch talk recording in a new tab' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove Launch talk recording and transcript' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Launch talk, 1:05' }));
    await user.click(screen.getByRole('button', { name: 'Unsafe talk, 0:01' }));

    expect(screen.getByRole('separator', { name: 'Unused recordings' })).toBeInTheDocument();
    expect(screen.getByText('Unsafe talk').compareDocumentPosition(screen.getByText('Launch talk'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Launch talk recording in a new tab' })).toHaveAttribute(
      'href',
      'blob:https://localstudio.test/launch',
    );
    expect(screen.queryByRole('link', { name: 'Open Unsafe talk recording in a new tab' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Unsafe talk recording in a new tab' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Open Launch talk transcript in a new tab' }));
    expect(createObjectUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:https://localstudio.test/transcript');

    expect(screen.queryByText('launch.webm')).not.toBeInTheDocument();
    expect(screen.queryByText('recording-1.transcript.json')).not.toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Remove Launch talk transcript' }));
    await user.click(screen.getByRole('button', { name: 'Remove Launch talk recording' }));
    await user.click(
      screen.getByRole('button', { name: 'Remove Launch talk recording and transcript' }),
    );

    expect(onRemoveTranscript).toHaveBeenCalledWith('recording-1');
    expect(onRemoveRecordingAudio).toHaveBeenCalledWith('recording-1');
    expect(onRemoveRecording).toHaveBeenCalledWith('recording-1');

    setTimeoutSpy.mockRestore();
    anchorClick.mockRestore();
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
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

});
