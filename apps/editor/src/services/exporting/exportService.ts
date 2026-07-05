import type { ProjectDocument } from '../../domain/documents/model';
import type { ExportService } from '../contracts/interfaces';

export class BrowserExportService implements ExportService {
  getPageImageFileName(project: ProjectDocument, pageId: string, extension: 'png' | 'jpeg'): string {
    const page = project.pages.find((item) => item.id === pageId);
    const pageName = page?.name ?? 'Page';
    return `${project.name}-${pageName}.${extension}`;
  }

  getPdfFileName(project: ProjectDocument): string {
    return `${project.name}.pdf`;
  }

  getPowerPointFileName(project: ProjectDocument): string {
    return `${project.name}.pptx`;
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
