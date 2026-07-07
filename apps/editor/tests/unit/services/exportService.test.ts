import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserExportService } from '../../../src/services/exporting/exportService';

describe('BrowserExportService', () => {
  it('creates export file names for page images and PDF', () => {
    const service = new BrowserExportService();
    const project = sampleProject.createSampleProject();

    expect(service.getPageImageFileName(project, 'page-1', 'png')).toBe(
      'Untitled AI Deck-Slide 1.png',
    );
    expect(service.getImagesArchiveFileName(project)).toBe('Untitled AI Deck-images.zip');
    expect(service.getPdfFileName(project)).toBe('Untitled AI Deck.pdf');
  });
});
