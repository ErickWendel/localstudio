import { collectReferencedAssetIds } from '../../domain/assets/assetUsage';
import type { ProjectDocument, TranscriptRecording } from '../../domain/documents/model';
import type {
  MirrorState,
  MirrorSyncProgress,
  ProjectRepository,
  ShareMetadata,
  SharePublishProgress,
} from '../contracts/interfaces';
import type { AuthoringOperationProgress } from './authoringOperationRegistry';
import { authoringRevision } from './getAuthoringSlideRevision';

const PUBLISH_LIMITS = {
  contextSlides: 50,
  fonts: 50,
  media: 100,
  text: 500,
  warnings: 20,
} as const;

export interface PresentationPublishSnapshot {
  project: ProjectDocument;
  revision: string;
}

export interface PresentationPublishProgress extends AuthoringOperationProgress {
  stage: 'assets' | 'completed' | 'pointer' | 'preparing' | 'warnings';
}

export interface PresentationPublishInput {
  shareId?: string | undefined;
  expectedRevision?: string | undefined;
}

export interface PresentationPublishContext {
  fonts: Array<{ family: string; source: string }>;
  recordings: Array<{
    recordingId: string;
    language: string;
    rawAudioIncluded: boolean;
    transcriptSegmentCount: number;
  }>;
  slides: Array<{
    description?: string | undefined;
    descriptionFreshness: 'fresh' | 'missing' | 'stale';
    descriptionLanguage?: string | undefined;
    slideId: string;
    slideNumber: number;
  }>;
  truncated: boolean;
}

export interface PresentationPublishMediaItem {
  assetId: string;
  fileName?: string | undefined;
  kind: 'gif' | 'image' | 'recording' | 'video';
  mimeType: string;
}

export interface PresentationPublishResult {
  shareId: string;
  publicUrl: string;
  embedUrl: string;
  revision: string;
  context: PresentationPublishContext;
  mediaManifest: PresentationPublishMediaItem[];
  mediaManifestTruncated: boolean;
  warnings: string[];
}

export interface PresentationPublishingMirror<TConfig> {
  loadConfig(): TConfig | null;
  syncProject(
    project: ProjectDocument,
    repository: ProjectRepository,
    config: TConfig,
    options?: { onProgress?: (progress: MirrorSyncProgress) => void },
  ): Promise<MirrorState>;
}

export interface PresentationPublishingShare {
  createShare(
    project: ProjectDocument,
    options?: { onProgress?: (progress: SharePublishProgress) => void },
  ): Promise<ShareMetadata>;
  updateShare(
    shareId: string,
    project: ProjectDocument,
    options?: { onProgress?: (progress: SharePublishProgress) => void },
  ): Promise<ShareMetadata>;
}

export interface PresentationPublishingCapabilityOptions<TConfig> {
  getSnapshot(): PresentationPublishSnapshot;
  isRawRecordingAuthorized?: ((recording: TranscriptRecording) => boolean) | undefined;
  mirror: PresentationPublishingMirror<TConfig>;
  repository: ProjectRepository;
  share: PresentationPublishingShare;
}

function cloneProject(project: ProjectDocument): ProjectDocument {
  return structuredClone(project);
}

function boundedText(value: string) {
  return value.trim().slice(0, PUBLISH_LIMITS.text);
}

function boundedWarnings(warnings: string[]) {
  return warnings.slice(0, PUBLISH_LIMITS.warnings).map((warning) => boundedText(warning));
}

function validateShareId(shareId: string | undefined) {
  if (shareId === undefined) return;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(shareId)) {
    throw new Error('Share ID must contain 1-128 letters, numbers, underscores, or hyphens.');
  }
}

function getDescriptionFreshness(project: ProjectDocument, pageIndex: number) {
  const page = project.pages[pageIndex];
  const description = page?.semanticDescription;
  if (!description) return 'missing' as const;
  return description.stale ||
    description.sourceRevision !== authoringRevision.getSlide(project, page.id)
    ? ('stale' as const)
    : ('fresh' as const);
}

function createPublicRecording(
  recording: TranscriptRecording,
  isRawAudioAuthorized: boolean,
): TranscriptRecording {
  if (isRawAudioAuthorized) return recording;
  return {
    ...recording,
    audio: { mimeType: recording.audio.mimeType },
  };
}

function getRecordingHasPublishableAudio(recording: TranscriptRecording) {
  return Boolean(
    recording.audio.objectUrl ||
    recording.audio.fileName ||
    recording.audio.storage === 'file' ||
    recording.audio.storage === 'remote',
  );
}

function progressBetween(current: number, total: number, start: number, length: number) {
  if (total <= 0) return start;
  return Math.min(start + length, start + Math.round((current / total) * length));
}

export class PresentationPublishingCapability<TConfig> {
  constructor(private readonly options: PresentationPublishingCapabilityOptions<TConfig>) {}

  async publish(
    input: PresentationPublishInput,
    report: (progress: PresentationPublishProgress) => void,
  ): Promise<PresentationPublishResult> {
    validateShareId(input.shareId);
    const config = this.options.mirror.loadConfig();
    if (!config) {
      throw new Error('Public sharing requires configured remote storage.');
    }

    const snapshot = this.options.getSnapshot();
    if (input.expectedRevision && input.expectedRevision !== snapshot.revision) {
      throw new Error(
        'The requested presentation revision is stale. Read the current state and retry.',
      );
    }

    report({ stage: 'preparing', progress: 5, detail: 'Preparing exact presentation revision' });
    const warnings: string[] = [];
    const project = cloneProject(snapshot.project);
    this.applyRecordingAuthorization(project, warnings);

    report({ stage: 'assets', progress: 10, detail: 'Publishing presentation assets' });
    let mirrorState: MirrorState;
    try {
      mirrorState = await this.options.mirror.syncProject(
        project,
        this.options.repository,
        config,
        {
          onProgress: (progress) =>
            report({
              stage: 'assets',
              progress: progressBetween(progress.current, progress.total, 10, 60),
              loadedBytes: progress.current,
              totalBytes: progress.total,
              detail: boundedText(progress.label),
            }),
        },
      );
    } catch {
      throw new Error('Could not publish presentation assets to configured remote storage.');
    }
    if (mirrorState.status !== 'synced') {
      throw new Error('Could not publish presentation assets to configured remote storage.');
    }

    if (this.options.getSnapshot().revision !== snapshot.revision) {
      throw new Error(
        'The presentation changed while publishing assets. Read the current state and retry.',
      );
    }

    if (warnings.length > 0) {
      report({
        stage: 'warnings',
        progress: 75,
        detail: 'Publishing with bounded media warnings',
        warnings: boundedWarnings(warnings),
      });
    }

    report({ stage: 'pointer', progress: 80, detail: 'Publishing public share pointer' });
    let share: ShareMetadata;
    try {
      const options = {
        authoringRevision: snapshot.revision,
        onProgress: (progress: SharePublishProgress) =>
          report({
            stage: 'pointer',
            progress: progressBetween(progress.current, progress.total, 80, 15),
            current: progress.current,
            total: progress.total,
            detail: boundedText(progress.label),
          }),
      };
      share = input.shareId
        ? await this.options.share.updateShare(input.shareId, project, options)
        : await this.options.share.createShare(project, options);
    } catch {
      throw new Error('Could not publish the presentation share pointer.');
    }

    const result = this.createResult(project, snapshot.revision, share, warnings);
    report({ stage: 'completed', progress: 100, detail: 'Published exact presentation revision' });
    return result;
  }

  private applyRecordingAuthorization(project: ProjectDocument, warnings: string[]) {
    if (!project.recordings) return;
    for (const [recordingId, recording] of Object.entries(project.recordings)) {
      const authorized = this.options.isRawRecordingAuthorized?.(recording) ?? false;
      project.recordings[recordingId] = createPublicRecording(recording, authorized);
      if (authorized && !getRecordingHasPublishableAudio(recording)) {
        warnings.push(`Authorized recording ${recordingId} has no publishable raw audio.`);
      }
    }
  }

  private createResult(
    project: ProjectDocument,
    revision: string,
    share: ShareMetadata,
    warnings: string[],
  ): PresentationPublishResult {
    const media = this.createMediaManifest(project);
    return {
      shareId: share.shareId,
      publicUrl: share.publicUrl,
      embedUrl: share.embedUrl,
      revision,
      context: this.createContext(project),
      mediaManifest: media.slice(0, PUBLISH_LIMITS.media),
      mediaManifestTruncated: media.length > PUBLISH_LIMITS.media,
      warnings: boundedWarnings(warnings),
    };
  }

  private createContext(project: ProjectDocument): PresentationPublishContext {
    const recordings = Object.values(project.recordings ?? {});
    const fonts = Object.values(project.fonts ?? {});
    const slides = project.pages;
    return {
      fonts: fonts.slice(0, PUBLISH_LIMITS.fonts).map((font) => ({
        family: boundedText(font.family),
        source: font.source,
      })),
      recordings: recordings.slice(0, PUBLISH_LIMITS.contextSlides).map((recording) => ({
        recordingId: recording.id,
        language: boundedText(recording.language ?? 'und'),
        rawAudioIncluded: getRecordingHasPublishableAudio(recording),
        transcriptSegmentCount: recording.segments.length,
      })),
      slides: slides.slice(0, PUBLISH_LIMITS.contextSlides).map((page, index) => ({
        slideId: page.id,
        slideNumber: index + 1,
        descriptionFreshness: getDescriptionFreshness(project, index),
        ...(page.semanticDescription
          ? {
              description: boundedText(page.semanticDescription.text),
              descriptionLanguage: boundedText(page.semanticDescription.language),
            }
          : {}),
      })),
      truncated:
        fonts.length > PUBLISH_LIMITS.fonts ||
        recordings.length > PUBLISH_LIMITS.contextSlides ||
        slides.length > PUBLISH_LIMITS.contextSlides,
    };
  }

  private createMediaManifest(project: ProjectDocument): PresentationPublishMediaItem[] {
    const referencedAssetIds = collectReferencedAssetIds(project);
    const assets = Object.values(project.assets)
      .filter((asset) => referencedAssetIds.has(asset.id))
      .map((asset) => ({
        assetId: asset.id,
        kind: asset.type,
        mimeType: asset.mimeType,
        ...(asset.fileName ? { fileName: asset.fileName } : {}),
      }));
    const recordings = Object.values(project.recordings ?? {})
      .filter(getRecordingHasPublishableAudio)
      .map((recording) => ({
        assetId: recording.id,
        kind: 'recording' as const,
        mimeType: recording.audio.mimeType,
        ...(recording.audio.fileName ? { fileName: recording.audio.fileName } : {}),
      }));
    return [...assets, ...recordings];
  }
}
