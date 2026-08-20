import type { ProjectDocument } from '../../../domain/documents/model';
import type { FontImportRequest } from '../../contracts/interfaces';

const SYSTEM_FONT_FAMILIES = new Set([
  'arial',
  'avenir',
  'candara',
  'consolas',
  'courier',
  'courier new',
  'georgia',
  'helvetica',
  'sans-serif',
  'serif',
  'system-ui',
  'tahoma',
  'times',
  'times new roman',
  'trebuchet ms',
  'verdana',
]);

const DOWNLOADABLE_COMPATIBLE_FONT_FAMILIES = new Set([
  'arial',
  'calibri',
  'cambria',
  'courier',
  'courier new',
  'helvetica',
  'times',
  'times new roman',
]);

function normalizeFontFamily(fontFamily: string) {
  return fontFamily
    .split(',')
    .at(0)
    ?.replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldDownloadFont(fontFamily: string | undefined) {
  if (!fontFamily) return false;
  if (fontFamily.startsWith('+')) return false;
  if (DOWNLOADABLE_COMPATIBLE_FONT_FAMILIES.has(fontFamily.toLowerCase())) return true;
  return !SYSTEM_FONT_FAMILIES.has(fontFamily.toLowerCase());
}

function collect(project: ProjectDocument): FontImportRequest[] {
  const requests = new Map<string, FontImportRequest>();
  const addRequest = (
    fontFamily: string,
    fontStyle: FontImportRequest['fontStyle'],
    fontWeight: number,
  ) => {
    const family = normalizeFontFamily(fontFamily);
    if (!family || !shouldDownloadFont(family)) return;
    const request: FontImportRequest = {
      family,
      fontStyle,
      fontWeight: fontWeight >= 700 ? 700 : 400,
    };
    requests.set(`${request.family.toLowerCase()}:${request.fontStyle}:${request.fontWeight}`, request);
  };
  for (const element of Object.values(project.elements)) {
    if (element.type !== 'text') continue;
    addRequest(element.fontFamily, 'normal', element.fontWeight);
    for (const paragraph of element.paragraphs ?? []) {
      addRequest(paragraph.fontFamily, paragraph.fontStyle, paragraph.fontWeight);
      for (const run of paragraph.runs ?? []) {
        addRequest(run.fontFamily, run.fontStyle, run.fontWeight);
      }
    }
  }
  return Array.from(requests.values());
}

export const pptxFontRequests = {
  collect,
};
