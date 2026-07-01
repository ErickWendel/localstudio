import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorFooter } from '../../../../src/ui/editor/shell/EditorFooter';

describe('EditorFooter', () => {
  it('calls zoom and pages actions without exposing fullscreen', async () => {
    const user = userEvent.setup();
    const handlers = {
      onResetZoom: vi.fn(),
      onOpenSettings: vi.fn(),
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
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
    await user.click(screen.getByRole('button', { name: 'Reset zoom' }));
    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));

    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onResetZoom).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(handlers.onTogglePagesPanel).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Enter fullscreen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).not.toBeInTheDocument();
  });
});
