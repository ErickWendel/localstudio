import type { ProjectDocument } from '../../../domain/documents/model';
import type { FontImportService } from '../../../services/contracts/interfaces';

async function loadProjectFonts(project: ProjectDocument, fontImportService: FontImportService) {
  await fontImportService.loadProjectFonts(project).catch(() => undefined);
}

function waitForNextPaint() {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

export const editorViewModelRuntime = {
  loadProjectFonts,
  waitForNextPaint,
};
