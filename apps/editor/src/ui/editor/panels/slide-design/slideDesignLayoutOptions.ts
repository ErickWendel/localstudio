import type { ProjectDocument } from '../../../../domain/documents/model';

export function getSlideDesignLayoutOptions(project: ProjectDocument) {
  return Object.values(project.slideLayouts ?? {});
}
