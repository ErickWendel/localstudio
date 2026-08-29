import type { ProjectDocument } from '../../domain/documents/model';
import type { TranslatorService } from '../contracts/interfaces';
import {
  deckDescriptionCapability,
  type LocalSlideDescriptionGenerator,
} from './deckDescriptionCapability';
import { deckTranslationCapability } from './deckTranslationCapability';

export interface DeckCapabilityProgress {
  stage?: string;
  progress?: number;
  current?: number;
  total?: number;
  detail?: string;
  loadedBytes?: number;
  totalBytes?: number;
  warnings?: string[];
}

export interface DeckCapabilityProgressReporter {
  (progress: DeckCapabilityProgress): void;
}

export interface DeckLocalizationCapabilityOptions {
  translatorService: TranslatorService;
  getProject(): ProjectDocument;
  applyProject(project: ProjectDocument, activePageId?: string): void;
  getProjectRevision(project: ProjectDocument): string;
  getSlideRevision(project: ProjectDocument, pageId: string): string;
  descriptionGenerator?: LocalSlideDescriptionGenerator | undefined;
  now?: (() => string) | undefined;
}

function createCapability(options: DeckLocalizationCapabilityOptions) {
  const translation = deckTranslationCapability.create(options);
  const description = deckDescriptionCapability.create(options);
  return {
    translateDeckAndNotes: translation.translateDeckAndNotes,
    generateDeckDetailedDescription: description.generateDeckDetailedDescription,
  };
}

export const deckLocalizationCapability = { create: createCapability };
