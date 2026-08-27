import type {
  AnimationDirection,
  AnimationEffect,
  ElementAnimationKind,
  ElementType,
  ProjectDocument,
} from '../../domain/documents/model';
import type { FontImportService, LocalFontMirrorService } from '../contracts/interfaces';

export type AuthoringFontSource = 'built-in' | 'downloadable' | 'local-folder' | 'project';
export type AuthoringFontReadiness = 'downloadable' | 'ready' | 'ready-local';

export interface AuthoringFontCatalogItem {
  aliases: string[];
  family: string;
  readiness: AuthoringFontReadiness;
  sources: AuthoringFontSource[];
}

export interface AuthoringAnimationCatalogItem {
  defaultDurationMs: number;
  defaultKind: ElementAnimationKind;
  defaultTrigger: 'on-click';
  directions: AnimationDirection[];
  effect: AnimationEffect;
  kinds: ElementAnimationKind[];
  label: string;
  triggers: Array<'after-previous' | 'after-transition' | 'on-click'>;
}

export type AuthoringCatalogResult =
  | {
      items: AuthoringFontCatalogItem[];
      kind: 'fonts';
      total: number;
      truncated: boolean;
      warnings: string[];
    }
  | {
      elementType: ElementType;
      items: AuthoringAnimationCatalogItem[];
      kind: 'animations';
      mediaActions: Array<'play'>;
      total: number;
    };

interface AuthoringCatalogCapabilityOptions {
  fontImportService: FontImportService;
  getProject(): ProjectDocument;
  localFontMirrorService: LocalFontMirrorService;
}

interface MutableFontCatalogItem {
  aliases: Set<string>;
  family: string;
  sources: Set<AuthoringFontSource>;
}

const MAX_FONT_RESULTS = 250;
const builtInFontFamilies = ['Arial', 'Inter', 'Open Sans', 'Orbitron'];
const genericAnimationEffects: AnimationEffect[] = [
  'blinds',
  'clothesline',
  'color-planes',
  'confetti',
  'cube',
  'doorway',
  'dissolve',
  'drop',
  'droplet',
  'fade',
  'fade-and-move',
  'fade-through-color',
  'fall',
  'flip',
  'flop',
  'grid',
  'iris',
  'mosaic',
  'move-in',
  'page-flip',
  'pivot',
  'push',
  'radial-wipe',
  'reflection',
  'reveal',
  'revolving-door',
  'scale',
  'swap',
  'switch',
  'swoosh',
  'twirl',
  'twist',
  'wipe',
];
const heavyAnimationEffects = new Set<AnimationEffect>([
  'blinds',
  'clothesline',
  'color-planes',
  'confetti',
  'cube',
  'doorway',
  'droplet',
  'fade-through-color',
  'fall',
  'flip',
  'flop',
  'grid',
  'iris',
  'mosaic',
  'page-flip',
  'pivot',
  'radial-wipe',
  'reflection',
  'revolving-door',
  'swoosh',
  'twirl',
  'twist',
]);
const directionalAnimationEffects = new Set<AnimationEffect>([
  'doorway',
  'fade-and-move',
  'move-in',
  'pivot',
  'push',
  'reveal',
  'revolving-door',
  'wipe',
]);
const animationDirections: AnimationDirection[] = ['down', 'left', 'right', 'up'];
const animationKinds: ElementAnimationKind[] = ['build-in', 'build-out', 'emphasis'];
const animationTriggers: AuthoringAnimationCatalogItem['triggers'] = [
  'on-click',
  'after-transition',
  'after-previous',
];

function normalizeFontFamily(family: string) {
  return family.trim().replace(/\s+/g, ' ');
}

function toAnimationLabel(effect: AnimationEffect) {
  return effect
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getFontReadiness(sources: Set<AuthoringFontSource>): AuthoringFontReadiness {
  if (sources.has('built-in') || sources.has('project')) return 'ready';
  if (sources.has('local-folder')) return 'ready-local';
  return 'downloadable';
}

export class AuthoringCatalogCapability {
  constructor(private readonly options: AuthoringCatalogCapabilityOptions) {}

  async list(input: {
    elementType?: ElementType | undefined;
    kind: 'animations' | 'fonts';
  }): Promise<AuthoringCatalogResult> {
    if (input.kind === 'animations') {
      if (!input.elementType) throw new Error('Animation discovery requires elementType.');
      return this.listAnimations(input.elementType);
    }
    return this.listFonts();
  }

  private async listFonts(): Promise<Extract<AuthoringCatalogResult, { kind: 'fonts' }>> {
    const catalog = new Map<string, MutableFontCatalogItem>();
    const warnings: string[] = [];
    const add = (familyValue: string, source: AuthoringFontSource, aliases: string[] = []) => {
      const family = normalizeFontFamily(familyValue);
      if (!family) return;
      const key = family.toLocaleLowerCase();
      const current = catalog.get(key) ?? {
        aliases: new Set<string>(),
        family,
        sources: new Set<AuthoringFontSource>(),
      };
      current.sources.add(source);
      aliases
        .map(normalizeFontFamily)
        .filter(Boolean)
        .forEach((alias) => current.aliases.add(alias));
      catalog.set(key, current);
    };

    builtInFontFamilies.forEach((family) => add(family, 'built-in'));
    Object.values(this.options.getProject().fonts ?? {}).forEach((font) =>
      add(font.family, 'project', [font.requestedFamily]),
    );
    this.options.fontImportService
      .listDownloadableFonts()
      .forEach((font) => add(font.family, 'downloadable', font.aliases));
    try {
      const localFonts = await this.options.localFontMirrorService.listAvailableFonts();
      localFonts.forEach((font) => add(font.family, 'local-folder', font.aliases));
    } catch {
      warnings.push('Local font folder could not be inspected. Reconnect it in font settings.');
    }

    const allItems = [...catalog.values()]
      .map<AuthoringFontCatalogItem>((item) => ({
        aliases: [...item.aliases]
          .filter((alias) => alias.toLocaleLowerCase() !== item.family.toLocaleLowerCase())
          .sort((first, second) => first.localeCompare(second)),
        family: item.family,
        readiness: getFontReadiness(item.sources),
        sources: [...item.sources].sort(),
      }))
      .sort((first, second) => first.family.localeCompare(second.family));
    return {
      items: allItems.slice(0, MAX_FONT_RESULTS),
      kind: 'fonts',
      total: allItems.length,
      truncated: allItems.length > MAX_FONT_RESULTS,
      warnings,
    };
  }

  private listAnimations(
    elementType: ElementType,
  ): Extract<AuthoringCatalogResult, { kind: 'animations' }> {
    const effects = [
      ...genericAnimationEffects,
      ...(elementType === 'text' ? (['keyboard-typing'] as const) : []),
      ...(elementType === 'shape' ? (['line-draw'] as const) : []),
    ];
    const items = effects.map<AuthoringAnimationCatalogItem>((effect) => ({
      defaultDurationMs: heavyAnimationEffects.has(effect) ? 700 : 500,
      defaultKind: 'build-in',
      defaultTrigger: 'on-click',
      directions: directionalAnimationEffects.has(effect) ? [...animationDirections] : [],
      effect,
      kinds: [...animationKinds],
      label: toAnimationLabel(effect),
      triggers: [...animationTriggers],
    }));
    return {
      elementType,
      items,
      kind: 'animations',
      mediaActions: elementType === 'video' ? ['play'] : [],
      total: items.length,
    };
  }
}
