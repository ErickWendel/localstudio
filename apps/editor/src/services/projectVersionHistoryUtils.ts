import type { ProjectDocument } from '../domain/model';

export function createVersionId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function cloneProjectForHistory(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    assets: Object.fromEntries(
      Object.entries(project.assets).map(([assetId, asset]) => {
        const assetForDisk = { ...asset };
        delete assetForDisk.objectUrl;
        return [assetId, assetForDisk];
      }),
    ),
  };
}

function getChangedElementKeys(previousProject: ProjectDocument, nextProject: ProjectDocument) {
  const changedElementIds = new Set<string>();
  const elementIds = new Set([...Object.keys(previousProject.elements), ...Object.keys(nextProject.elements)]);
  for (const elementId of elementIds) {
    if (JSON.stringify(previousProject.elements[elementId]) !== JSON.stringify(nextProject.elements[elementId])) {
      changedElementIds.add(elementId);
    }
  }
  return changedElementIds;
}

export function createChangeSummary(project: ProjectDocument, previousProject?: ProjectDocument) {
  if (!previousProject) {
    const firstPage = project.pages[0];
    return {
      changeCount: 1,
      summary: 'Initial saved version',
      ...(firstPage ? { firstChangedPageId: firstPage.id } : {}),
    };
  }

  let changeCount = 0;
  let firstChangedPageId: string | undefined;
  let firstChangedElementId: string | undefined;
  const changedElementIds = getChangedElementKeys(previousProject, project);

  for (const elementId of changedElementIds) {
    changeCount += 1;
    const page =
      project.pages.find((item) => item.elementIds.includes(elementId)) ??
      previousProject.pages.find((item) => item.elementIds.includes(elementId));
    firstChangedPageId ??= page?.id;
    firstChangedElementId ??= elementId;
  }

  const pageIds = new Set([...previousProject.pages.map((page) => page.id), ...project.pages.map((page) => page.id)]);
  for (const pageId of pageIds) {
    const previousPage = previousProject.pages.find((page) => page.id === pageId);
    const nextPage = project.pages.find((page) => page.id === pageId);
    if (JSON.stringify(previousPage) !== JSON.stringify(nextPage)) {
      changeCount += 1;
      firstChangedPageId ??= nextPage?.id ?? previousPage?.id;
      const pageElementIds = [...(nextPage?.elementIds ?? []), ...(previousPage?.elementIds ?? [])];
      firstChangedElementId ??= pageElementIds.find((elementId) => changedElementIds.has(elementId));
    }
  }

  for (const assetId of new Set([...Object.keys(previousProject.assets), ...Object.keys(project.assets)])) {
    if (JSON.stringify(previousProject.assets[assetId]) !== JSON.stringify(project.assets[assetId])) {
      changeCount += 1;
    }
  }

  if (project.name !== previousProject.name) changeCount += 1;
  if (changeCount === 0) {
    return {
      changeCount: 0,
      summary: 'No visible changes',
      ...(project.pages[0] ? { firstChangedPageId: project.pages[0].id } : {}),
    };
  }

  return {
    changeCount,
    summary: `${changeCount} ${changeCount === 1 ? 'edit' : 'edits'}`,
    ...(firstChangedPageId ? { firstChangedPageId } : {}),
    ...(firstChangedElementId ? { firstChangedElementId } : {}),
  };
}
