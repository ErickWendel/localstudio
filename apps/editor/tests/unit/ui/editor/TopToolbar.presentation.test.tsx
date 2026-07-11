import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/toolbars/TopToolbar';

describe('TopToolbar presentation actions', () => {
  it('opens presenter view from the play button near the project name by default', async () => {
    const user = userEvent.setup();
    const onOpenPresenterView = vi.fn();
    const onStartPresenterMode = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onOpenPresenterView={onOpenPresenterView}
        onStartPresenterMode={onStartPresenterMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play presentation' }));

    expect(onOpenPresenterView).toHaveBeenCalledTimes(1);
    expect(onStartPresenterMode).not.toHaveBeenCalled();
  });

  it('starts presenter mode from the play button when presenter view is unavailable', async () => {
    const user = userEvent.setup();
    const onStartPresenterMode = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onStartPresenterMode={onStartPresenterMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play presentation' }));

    expect(onStartPresenterMode).toHaveBeenCalledTimes(1);
    expect(onStartPresenterMode).toHaveBeenCalledWith();
  });

  it('starts presenter mode from the beginning from the play menu', async () => {
    const user = userEvent.setup();
    const onStartPresenterMode = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onStartPresenterMode={onStartPresenterMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Play from beginning' }));

    expect(onStartPresenterMode).toHaveBeenCalledWith({ fromBeginning: true });
  });

  it('opens presenter view from the play menu', async () => {
    const user = userEvent.setup();
    const onOpenPresenterView = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onOpenPresenterView={onOpenPresenterView}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));

    expect(screen.getByRole('menuitem', { name: 'Present in fullscreen' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Presenter view' }));

    expect(onOpenPresenterView).toHaveBeenCalledTimes(1);
  });
});
