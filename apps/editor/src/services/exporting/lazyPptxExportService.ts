import type { ProjectDocument } from '../../domain/documents/model';
import type {
  PresentationExportOptions,
  PresentationExportResult,
  PresentationExportService,
} from '../contracts/interfaces';

export class LazyPptxExportService implements PresentationExportService {
  async exportPowerPoint(
    project: ProjectDocument,
    options?: PresentationExportOptions,
  ): Promise<PresentationExportResult> {
    const { BrowserPptxExportService } = await import('./pptxExportService');
    return new BrowserPptxExportService().exportPowerPoint(project, options);
  }
}
