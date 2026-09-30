import type { ProjectDocument } from '../../domain/documents/model';
import type { ExportService, PresentationExportCompatibilityTarget } from '../contracts/interfaces';

export class BrowserExportService implements ExportService {
  getPageImageFileName(
    project: ProjectDocument,
    pageId: string,
    extension: 'png' | 'jpeg',
  ): string {
    const page = project.pages.find((item) => item.id === pageId);
    const pageName = page?.name ?? 'Page';
    return `${project.name}-${pageName}.${extension}`;
  }

  getImagesArchiveFileName(project: ProjectDocument): string {
    return `${project.name}-images.zip`;
  }

  getPdfFileName(project: ProjectDocument): string {
    return `${project.name}.pdf`;
  }

  getPowerPointFileName(
    project: ProjectDocument,
    compatibilityTarget: PresentationExportCompatibilityTarget = 'powerpoint',
  ): string {
    const suffix = compatibilityTarget === 'keynote-google-slides' ? '-keynote-google-slides' : '';
    return `${project.name}${suffix}.pptx`;
  }

  downloadBlob(blob: Blob, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  downloadDataUrl(dataUrl: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.click();
  }
}
