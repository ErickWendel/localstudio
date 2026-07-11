import type {
  PresenterRemotePreviewBatch,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';

function mergePreviewBatchIntoState(
  state: PresenterRemoteState,
  batch: PresenterRemotePreviewBatch,
): PresenterRemoteState {
  if (batch.previews.length === 0) return state;
  const previewsByPageId = new Map(batch.previews.map((page) => [page.id, page.preview]));
  const pages = state.pages?.map((page) => {
    if (!previewsByPageId.has(page.id)) return page;
    return {
      ...page,
      preview: previewsByPageId.get(page.id),
    };
  });
  const activePagePreview = previewsByPageId.get(state.activePageId) ?? state.slidePreview;
  const upcomingSlidePreviews =
    pages?.slice(state.activePageIndex + 1, state.activePageIndex + 4).flatMap((page) => {
      const preview =
        page.preview ??
        state.upcomingSlidePreviews?.find((upcomingPreview) => upcomingPreview.pageId === page.id)
          ?.preview;
      if (!preview) return [];
      return [
        {
          pageId: page.id,
          pageName: page.name,
          preview,
        },
      ];
    }) ?? state.upcomingSlidePreviews;
  return {
    ...state,
    nextSlidePreview: upcomingSlidePreviews?.[0]?.preview ?? state.nextSlidePreview,
    pages,
    slidePreview: activePagePreview,
    upcomingSlidePreviews,
  };
}

function getUpcomingSlidePreviews(
  displayedRemoteState: PresenterRemoteState | undefined,
): NonNullable<PresenterRemoteState['upcomingSlidePreviews']> {
  if (!displayedRemoteState) return [];
  const pages = displayedRemoteState.pages ?? [];
  const existingPreviews = displayedRemoteState.upcomingSlidePreviews ?? [];
  if (pages.length === 0) return existingPreviews;
  const upcomingPages = pages.slice(
    displayedRemoteState.activePageIndex + 1,
    displayedRemoteState.activePageIndex + 4,
  );
  if (upcomingPages.length === 0) return existingPreviews;
  const derivedPreviews = upcomingPages.map((page, index) => ({
    pageId: page.id,
    pageName: page.name,
    preview:
      page.preview ??
      existingPreviews.find((preview) => preview.pageId === page.id)?.preview ??
      (index === 0 ? displayedRemoteState.nextSlidePreview : undefined),
  }));
  const derivedPageIds = new Set(derivedPreviews.map((preview) => preview.pageId));
  return [
    ...derivedPreviews,
    ...existingPreviews.filter((preview) => !derivedPageIds.has(preview.pageId)),
  ];
}

export const joystickRemotePreviews = {
  getUpcomingSlidePreviews,
  mergePreviewBatchIntoState,
};
