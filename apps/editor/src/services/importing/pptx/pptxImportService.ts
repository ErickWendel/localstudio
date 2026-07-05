import type { ProjectDocument } from '../../../domain/documents/model';
import { pptxImportLogger } from './pptxImportLogger';
import { pptxPackage } from './pptxPackage';
import type { PptxImportInput } from './pptxPackageTypes';
import { pptxParser } from './pptxParser';
import { pptxProjectMapper } from './pptxProjectMapper';
import { pptxZip } from './pptxZip';

export type { PptxImportInput } from './pptxPackageTypes';

export class BrowserPptxImportService {
  async importPowerPoint(input: PptxImportInput): Promise<ProjectDocument> {
    pptxImportLogger.info('Starting PPTX import service.', {
      name: input.file.name,
      size: input.file.size,
      type: input.file.type,
    });
    const files = await pptxZip.readPackage(input.file);
    pptxImportLogger.info('Read PPTX package files.', {
      fileCount: files.length,
      samplePaths: files.slice(0, 8).map((file) => file.path),
    });
    const packageModel = await pptxPackage.create(files);
    const deck = await pptxParser.parse({ package: packageModel, themeCache: new Map() }, input.file.name);
    const project = pptxProjectMapper.map(deck, packageModel);
    pptxImportLogger.info('Finished PPTX import service.', {
      assetCount: Object.keys(project.assets).length,
      elementCount: Object.keys(project.elements).length,
      pageCount: project.pages.length,
    });
    return project;
  }
}
