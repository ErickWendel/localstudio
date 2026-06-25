import type { Asset } from '../domain/model';
import type {
  BackgroundRemovalService,
  ImageGenerationService,
  MagicEraserService,
  PaletteService,
  SmartGrabService,
  TranslatorService,
} from './interfaces';

export class MockTranslatorService implements TranslatorService {
  detectLanguage(text = ''): Promise<string> {
    if (/\[(pt|es|fr|de|it|en)\]/i.test(text)) {
      return Promise.resolve(text.match(/\[(pt|es|fr|de|it|en)\]/i)?.[1]?.toLowerCase() ?? 'en');
    }
    if (/[áéíóúñ¿¡]/i.test(text)) return Promise.resolve('es');
    return Promise.resolve('en');
  }

  prepareTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    void sourceLanguage;
    void targetLanguage;
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  translate(text: string, targetLanguage: string): Promise<string> {
    return Promise.resolve(`[${targetLanguage}] ${text}`);
  }
}

export class MockPaletteService implements PaletteService {
  generatePalette(prompt: string): Promise<{ name: string; colors: string[] }> {
    return Promise.resolve({
      name: prompt || 'EW Neon',
      colors: ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'],
    });
  }
}

export class MockImageGenerationService implements ImageGenerationService {
  generateImage(prompt: string): Promise<Asset> {
    const safeName = prompt.trim() || 'Generated image';
    const safeId = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'image';
    return Promise.resolve({
      id: `asset-generated-${safeId}`,
      type: 'image',
      name: `${safeName}.png`,
      mimeType: 'image/png',
      objectUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
    });
  }
}

export class MockBackgroundRemovalService implements BackgroundRemovalService {
  prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    void asset;
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  previewBackgroundMask(
    asset: Asset,
    options?: { subjectPoint?: { x: number; y: number } },
  ): Promise<{ maskUrl: string; score: number }> {
    void asset;
    void options;
    return Promise.resolve({
      maskUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGOSHzRgAAAAABJRU5ErkJggg==',
      score: 0.9,
    });
  }

  removeBackground(
    asset: Asset,
    options?: { subjectPoint?: { x: number; y: number } },
  ): Promise<{ asset: Asset; bounds: { x: number; y: number; width: number; height: number } }> {
    void options;
    return Promise.resolve({
      asset: {
        ...asset,
        id: `${asset.id}-transparent`,
        name: `${asset.name} BG Removed`,
        mimeType: 'image/png',
      },
      bounds: { x: 0, y: 0, width: 1, height: 1 },
    });
  }
}

export class MockSmartGrabService implements SmartGrabService {
  suggestSubjectRegion(): Promise<{ x: number; y: number; width: number; height: number }> {
    return Promise.resolve({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  }
}

export class MockMagicEraserService implements MagicEraserService {
  createMask(assetId: string): Promise<{ maskAssetId: string }> {
    return Promise.resolve({ maskAssetId: `${assetId}-mask` });
  }
}
