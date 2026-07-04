import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { pptxFontRequests } from '../../../src/services/importing/pptx/pptxFontRequests';

describe('pptxFontRequests', () => {
  it('collects unique downloadable text font requests from a PPTX project', () => {
    const project: ProjectDocument = {
      ...sampleProject.createBlankProject(),
      elements: {
        title: {
          id: 'title',
          type: 'text',
          text: 'Title',
          x: 0,
          y: 0,
          width: 100,
          height: 30,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          align: 'left',
          fill: '#111111',
          fontFamily: 'Montserrat',
          fontSize: 32,
          fontWeight: 700,
        },
        subtitle: {
          id: 'subtitle',
          type: 'text',
          text: 'Subtitle',
          x: 0,
          y: 40,
          width: 100,
          height: 30,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          align: 'left',
          fill: '#111111',
          fontFamily: 'Montserrat',
          fontSize: 20,
          fontWeight: 700,
        },
        body: {
          id: 'body',
          type: 'text',
          text: 'Body',
          x: 0,
          y: 80,
          width: 100,
          height: 30,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          align: 'left',
          fill: '#111111',
          fontFamily: 'Merriweather',
          fontSize: 20,
          fontWeight: 400,
        },
        system: {
          id: 'system',
          type: 'text',
          text: 'System',
          x: 0,
          y: 120,
          width: 100,
          height: 30,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          align: 'left',
          fill: '#111111',
          fontFamily: 'Arial',
          fontSize: 20,
          fontWeight: 400,
        },
      },
    };

    expect(pptxFontRequests.collect(project)).toEqual([
      { family: 'Montserrat', fontStyle: 'normal', fontWeight: 700 },
      { family: 'Merriweather', fontStyle: 'normal', fontWeight: 400 },
    ]);
  });
});
