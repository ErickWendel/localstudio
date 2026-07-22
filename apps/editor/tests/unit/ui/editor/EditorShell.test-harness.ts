import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { editorShellBackgroundFixtures } from './EditorShell.background-fixtures';
import { editorShellClipboardFixtures } from './EditorShell.clipboard-fixtures';
import { editorShellMediaFixtures } from './EditorShell.media-fixtures';
import { editorShellPersistenceFixtures } from './EditorShell.persistence-fixtures';
import { editorShellTranslationFixtures } from './EditorShell.translation-fixtures';

function createAppServices(options: Parameters<typeof createRealAppServices>[0] = {}) {
  vi.stubGlobal('showDirectoryPicker', vi.fn());
  return createRealAppServices({
    initialProject: sampleProject.createSampleProject(),
    ...options,
  });
}

async function waitForShareButtonReady() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Share' })).not.toBeDisabled();
  });
}

async function startFullscreenPresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
  await user.click(screen.getByRole('menuitem', { name: 'Present in fullscreen' }));
}

async function openLeftTab(
  user: ReturnType<typeof userEvent.setup>,
  name: 'AI Tools' | 'Animate' | 'Design' | 'Elements' | 'Layout',
) {
  void user;
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') {
    fireEvent.click(tab);
  }
  await Promise.resolve();
}

async function selectTitleLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  fireEvent.click(screen.getByRole('button', { name: 'Title' }));
}

async function selectImageLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  fireEvent.click(screen.getByRole('button', { name: 'Selected Image' }));
}

export const editorShellTestHarness = {
  createAppServices,
  ...editorShellBackgroundFixtures,
  ...editorShellClipboardFixtures,
  ...editorShellMediaFixtures,
  ...editorShellPersistenceFixtures,
  ...editorShellTranslationFixtures,
  openLeftTab,
  selectImageLayer,
  selectTitleLayer,
  startFullscreenPresentation,
  waitForShareButtonReady,
};
