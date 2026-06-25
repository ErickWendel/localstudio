import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorFooter } from '../../../../src/ui/editor/EditorFooter';

describe('EditorFooter', () => {
  it('calls zoom, pages, and fullscreen actions', async () => {
    const user = userEvent.setup();
    const handlers = {
      onResetZoom: vi.fn(),
      onToggleFullscreen: vi.fn(),
      onTogglePagesPanel: vi.fn(),
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
    };

    render(
      <EditorFooter
        activePageIndex={1}
        pageCount={4}
        pagesPanelOpen
        zoomPercent={125}
        {...handlers}
      />,
    );

    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
    await user.click(screen.getByRole('button', { name: 'Reset zoom' }));
    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }));

    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onResetZoom).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(handlers.onTogglePagesPanel).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleFullscreen).toHaveBeenCalledTimes(1);
  });
});
