import { useState } from 'react';
import { basicCommands } from '../../../domain/commands/elements/basicCommands';
import { fitImageWithinPage } from '../../../domain/images/imageSizing';
import type { ProjectDocument } from '../../../domain/documents/model';
import { createPrefixedId } from '../../../services/ids/idUtils';
import { localMediaFiles } from './local-media-files';
import { mediaPlaceholderReplacement } from './mediaPlaceholderReplacement';

export interface MediaImportProgressState {
  detail: string;
  title: string;
  tone: 'loading' | 'error';
}

interface UseLocalMediaImportOptions {
  activePageId: string;
  commitProject: (
    updater: (currentProject: ProjectDocument) => ProjectDocument,
    options?: { selectedElementIds?: string[] },
  ) => void;
  project: ProjectDocument;
  selectedElementIds: string[];
}

function waitForNextPaint() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

export function useLocalMediaImport({
  activePageId,
  commitProject,
  project,
  selectedElementIds,
}: UseLocalMediaImportOptions) {
  const [mediaImportProgress, setMediaImportProgress] = useState<
    MediaImportProgressState | undefined
  >();

  async function importImageFile(file: File) {
    const assetType = localMediaFiles.getMediaAssetType(file);
    if (assetType === 'video' && !localMediaFiles.isSupportedLocalVideoFile(file)) {
      setMediaImportProgress({
        detail:
          'Video import supports MP4 and WebM files. Convert this clip to MP4 or WebM and import it again.',
        title: 'Unsupported video format',
        tone: 'error',
      });
      return;
    }

    setMediaImportProgress({
      detail:
        assetType === 'video'
          ? 'Loading video metadata without copying the full file into memory.'
          : assetType === 'gif'
            ? 'Loading animated media from disk.'
            : 'Loading image from disk.',
      title: 'Loading media',
      tone: 'loading',
    });
    await waitForNextPaint();

    let imported = false;
    let objectUrl: string | undefined;
    try {
      objectUrl =
        assetType === 'video' || assetType === 'gif'
          ? localMediaFiles.createMediaObjectUrl(file)
          : undefined;
      const mediaUrl = objectUrl ?? (await localMediaFiles.readImageFileAsDataUrl(file));
      const mediaSize =
        assetType === 'video'
          ? await localMediaFiles.readVideoSize(mediaUrl)
          : await localMediaFiles.readImageSize(mediaUrl);
      const videoDurationSeconds =
        assetType === 'video' &&
        'durationSeconds' in mediaSize &&
        typeof mediaSize.durationSeconds === 'number'
          ? mediaSize.durationSeconds
          : undefined;
      const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
      if (!page) {
        setMediaImportProgress(undefined);
        return;
      }

      const assetId = createPrefixedId('asset');
      const elementId = createPrefixedId(assetType);
      const mediaName =
        file.name.trim() ||
        (assetType === 'video'
          ? 'Pasted video'
          : assetType === 'gif'
            ? 'Pasted GIF'
            : 'Pasted image');
      const fittedMedia = fitImageWithinPage({
        imageWidth: mediaSize.width,
        imageHeight: mediaSize.height,
        pageWidth: page.width,
        pageHeight: page.height,
      });
      const placeholder = mediaPlaceholderReplacement.getSelectedImagePlaceholder({
        project,
        selectedElementIds,
      });

      if (assetType === 'gif') {
        const asset = {
          id: assetId,
          type: 'gif',
          name: mediaName,
          mimeType: file.type || 'image/gif',
          objectUrl: mediaUrl,
        } as const;
        if (placeholder) {
          commitProject(
            (currentProject) =>
              new basicCommands.ReplaceElementWithMediaCommand(placeholder.id, {
                asset,
                element: mediaPlaceholderReplacement.createGifElement({
                  assetId,
                  mediaHeight: mediaSize.height,
                  mediaWidth: mediaSize.width,
                  placeholder,
                }),
              }).execute(currentProject),
            { selectedElementIds: [placeholder.id] },
          );
          imported = true;
          return;
        }

        commitProject(
          (currentProject) =>
            new basicCommands.AddMediaElementCommand(activePageId, {
              asset,
              element: {
                id: elementId,
                type: 'gif',
                assetId,
                x: fittedMedia.x,
                y: fittedMedia.y,
                width: fittedMedia.width,
                height: fittedMedia.height,
                rotation: 0,
                locked: false,
                visible: true,
                opacity: 1,
                playing: true,
              },
            }).execute(currentProject),
          { selectedElementIds: [elementId] },
        );
        imported = true;
        return;
      }

      if (assetType === 'video') {
        const asset = {
          id: assetId,
          type: 'video',
          name: mediaName,
          mimeType: file.type || 'video/mp4',
          objectUrl: mediaUrl,
        } as const;
        if (placeholder) {
          commitProject(
            (currentProject) =>
              new basicCommands.ReplaceElementWithMediaCommand(placeholder.id, {
                asset,
                element: mediaPlaceholderReplacement.createVideoElement({
                  assetId,
                  durationSeconds: videoDurationSeconds,
                  mediaHeight: mediaSize.height,
                  mediaWidth: mediaSize.width,
                  placeholder,
                }),
              }).execute(currentProject),
            { selectedElementIds: [placeholder.id] },
          );
          imported = true;
          return;
        }

        commitProject(
          (currentProject) =>
            new basicCommands.AddMediaElementCommand(activePageId, {
              asset,
              element: {
                id: elementId,
                type: 'video',
                assetId,
                x: fittedMedia.x,
                y: fittedMedia.y,
                width: fittedMedia.width,
                height: fittedMedia.height,
                rotation: 0,
                locked: false,
                visible: true,
                opacity: 1,
                loop: false,
                controls: true,
                muted: true,
                autoplayInPreview: true,
                playing: true,
                trimStartSeconds: 0,
                ...(videoDurationSeconds !== undefined
                  ? {
                      durationSeconds: videoDurationSeconds,
                      trimEndSeconds: videoDurationSeconds,
                    }
                  : {}),
              },
            }).execute(currentProject),
          { selectedElementIds: [elementId] },
        );
        imported = true;
        return;
      }

      const asset = {
        id: assetId,
        type: 'image',
        name: mediaName,
        mimeType: file.type || 'image/*',
        objectUrl: mediaUrl,
      } as const;
      if (placeholder) {
        commitProject(
          (currentProject) =>
            new basicCommands.ReplaceElementWithMediaCommand(placeholder.id, {
              asset,
              element: mediaPlaceholderReplacement.createImageElement({
                assetId,
                mediaHeight: mediaSize.height,
                mediaWidth: mediaSize.width,
                placeholder,
              }),
            }).execute(currentProject),
          { selectedElementIds: [placeholder.id] },
        );
        imported = true;
        return;
      }

      commitProject(
        (currentProject) =>
          new basicCommands.AddImageElementCommand(activePageId, {
            asset,
            element: {
              id: elementId,
              type: 'image',
              assetId,
              x: fittedMedia.x,
              y: fittedMedia.y,
              width: fittedMedia.width,
              height: fittedMedia.height,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
            },
          }).execute(currentProject),
        { selectedElementIds: [elementId] },
      );
      imported = true;
    } catch (error) {
      setMediaImportProgress({
        detail:
          error instanceof Error
            ? error.message
            : 'The selected media file could not be loaded.',
        title: 'Media import failed',
        tone: 'error',
      });
      return;
    } finally {
      if (!imported && objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
      if (imported) setMediaImportProgress(undefined);
    }
  }

  async function replaceVideoAsset(elementId: string, file: File) {
    if (localMediaFiles.getMediaAssetType(file) !== 'video') return;
    const dataUrl = await localMediaFiles.readImageFileAsDataUrl(file);
    const mediaSize = await localMediaFiles.readVideoSize(dataUrl);
    const videoDurationSeconds = mediaSize.durationSeconds;
    const assetId = createPrefixedId('asset');
    const mediaName = file.name.trim() || 'Replacement video';

    commitProject(
      (currentProject) =>
        new basicCommands.ReplaceVideoAssetCommand(
          elementId,
          {
            id: assetId,
            type: 'video',
            name: mediaName,
            mimeType: file.type || 'video/mp4',
            objectUrl: dataUrl,
          },
          videoDurationSeconds !== undefined ? { durationSeconds: videoDurationSeconds } : {},
        ).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
  }

  function clearMediaImportProgress() {
    setMediaImportProgress(undefined);
  }

  return {
    clearMediaImportProgress,
    importImageFile,
    mediaImportProgress,
    replaceVideoAsset,
  };
}
