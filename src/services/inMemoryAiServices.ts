import type {
  BackgroundRemovalService,
  MagicEraserService,
  PaletteService,
  SmartGrabService,
  TranslatorService,
} from './interfaces';

export class MockTranslatorService implements TranslatorService {
  detectLanguage(): Promise<string> {
    return Promise.resolve('PT-BR');
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

export class MockBackgroundRemovalService implements BackgroundRemovalService {
  removeBackground(
    assetId: string,
    options?: { subjectPoint?: { x: number; y: number } },
  ): Promise<{ assetId: string }> {
    void options;
    return Promise.resolve({ assetId: `${assetId}-transparent` });
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
