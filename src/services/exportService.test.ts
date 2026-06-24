import { createSampleProject } from '../domain/sampleProject';
import { BrowserExportService } from './exportService';

describe('BrowserExportService', () => {
  it('creates export file names for page images and PDF', () => {
    const service = new BrowserExportService();
    const project = createSampleProject();

    expect(service.getPageImageFileName(project, 'page-1', 'png')).toBe(
      'Untitled AI Deck-Slide 1.png',
    );
    expect(service.getPdfFileName(project)).toBe('Untitled AI Deck.pdf');
  });
});
