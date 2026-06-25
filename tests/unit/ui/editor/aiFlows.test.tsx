import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices } from '../../../../src/app/composition';
import type { TranslatorService } from '../../../../src/services/interfaces';
import { InMemoryModelSetupService } from '../../../../src/services/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/EditorShell';

class PreparingTranslatorService implements TranslatorService {
  prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(35);
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );

  detectLanguage(): Promise<string> {
    return Promise.resolve('en');
  }

  translate(text: string, targetLanguage: string): Promise<string> {
    return Promise.resolve(`${targetLanguage}:${text}`);
  }
}

describe('mocked AI flows', () => {
  it('downloads required models from AI Tools panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Required Models' }));

    expect(await screen.findAllByText('Ready')).toHaveLength(1);
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
  });

  it('exposes selected-object AI shortcuts', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
    expect(screen.getByLabelText('Translate Selected Text')).toBeInTheDocument();
  });

  it('configures the default translation target from AI Tools', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new PreparingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');

    expect(screen.getByLabelText('Translate to')).toHaveValue('es');
    expect(translator.prepareTranslation).toHaveBeenCalledWith('en', 'es', expect.any(Object));
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pair: en → es')).toBeInTheDocument();
    expect(window.localStorage.getItem('localstudio.ai.translation-target-language')).toBe('es');
    expect(
      screen.getByText('Choose the language that will be used for all translations in this deck.'),
    ).toBeInTheDocument();
  });

  it('lists Chrome-supported translation target languages', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));

    const options = screen.getAllByRole<HTMLOptionElement>('option');
    expect(options).toHaveLength(40);
    expect(options.map((option) => option.value)).toEqual([
      '',
      'ar',
      'bn',
      'bg',
      'zh',
      'zh-Hant',
      'hr',
      'cs',
      'da',
      'nl',
      'en',
      'fi',
      'fr',
      'de',
      'el',
      'iw',
      'hi',
      'hu',
      'id',
      'it',
      'ja',
      'kn',
      'ko',
      'lt',
      'mr',
      'no',
      'pl',
      'pt',
      'ro',
      'ru',
      'sk',
      'sl',
      'es',
      'sv',
      'ta',
      'te',
      'th',
      'tr',
      'uk',
      'vi',
    ]);
    expect(screen.getByRole('option', { name: 'Hebrew (iw) 🇮🇱' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chinese (Traditional) (zh-Hant) 🇹🇼' })).toBeInTheDocument();
  });
});
