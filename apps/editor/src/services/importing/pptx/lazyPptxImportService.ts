import type { ProjectDocument } from '../../../domain/documents/model';
import type { PresentationImportService } from '../../contracts/interfaces';
import type { PptxImportInput } from './pptxPackageTypes';

export class LazyPptxImportService implements PresentationImportService {
  async importPowerPoint(input: PptxImportInput): Promise<ProjectDocument> {
    const { BrowserPptxImportService } = await import('./pptxImportService');
    return new BrowserPptxImportService().importPowerPoint(input);
  }
}
