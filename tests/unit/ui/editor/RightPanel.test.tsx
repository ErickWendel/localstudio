import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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
  it('switches between AI Tools, Design, and Layers tabs', async () => {
    const user = userEvent.setup();
    let activeTab: 'design' | 'layers' | 'ai-tools' = 'ai-tools';
    const onTabChange = vi.fn((tab: 'design' | 'layers' | 'ai-tools') => {
      activeTab = tab;
    });

    const { rerender } = render(
      <RightPanel activeTab={activeTab} onTabChange={onTabChange} modelStates={modelStates} />,
    );

    expect(screen.getByText('Download Required Models')).toBeInTheDocument();
    expect(screen.getByText('Background Remover')).toBeInTheDocument();
    expect(screen.getByText('Magic Eraser')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    rerender(<RightPanel activeTab="design" onTabChange={onTabChange} modelStates={modelStates} />);
    expect(screen.getByText('16:9 Presentation')).toBeInTheDocument();
    expect(screen.getByText('Text-to-Palette')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Layers' }));
    rerender(<RightPanel activeTab="layers" onTabChange={onTabChange} modelStates={modelStates} />);
    expect(screen.getByText('5 layers on current page')).toBeInTheDocument();
    expect(screen.getByText('Selected Image')).toBeInTheDocument();
  });
});
