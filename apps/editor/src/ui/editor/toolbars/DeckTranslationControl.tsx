import type { RefObject } from 'react';
import type { TranslationLanguageOption } from '../translation/translationLanguages';

export function DeckTranslationControl({
  canTranslateDeck,
  deckTranslationStatus,
  isMenuOpen,
  isTranslatingDeck,
  menuRef,
  translationLanguageOptions,
  translationSourceLanguage,
  translationTargetLanguage,
  onMenuOpenChange,
  onTranslationSourceLanguageChange,
  onTranslationTargetLanguageChange,
  onTranslateDeck,
}: {
  canTranslateDeck: boolean;
  deckTranslationStatus?: string | undefined;
  isMenuOpen: boolean;
  isTranslatingDeck: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  translationLanguageOptions: TranslationLanguageOption[];
  translationSourceLanguage: string;
  translationTargetLanguage: string;
  onMenuOpenChange: (isOpen: boolean) => void;
  onTranslationSourceLanguageChange?: ((languageCode: string) => void) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
  onTranslateDeck?: (() => void) | undefined;
}) {
  const deckTranslateButtonClassName = [
    'stitch-icon-button',
    'deck-translate-button',
    isTranslatingDeck ? 'deck-translate-button-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="deck-translation-shell" ref={menuRef}>
        <button
          className={`${deckTranslateButtonClassName} deck-translation-main`}
          disabled={!canTranslateDeck || !onTranslateDeck}
          title={deckTranslationStatus ?? 'Translate deck using the selected target language'}
          type="button"
          aria-label="Translate deck"
          data-tour-id="translate-deck"
          onClick={onTranslateDeck}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            translate
          </span>
        </button>
        <button
          className="stitch-icon-button deck-translation-menu-button"
          type="button"
          aria-expanded={isMenuOpen}
          aria-label="Translation path options"
          title="Translation path options"
          onClick={() => {
            onMenuOpenChange(!isMenuOpen);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            keyboard_arrow_down
          </span>
        </button>
        {isMenuOpen ? (
          <div className="translation-path-dropdown" role="group" aria-label="Translation path">
            <label className="translation-path-field ew-field-scope">
              <span>From</span>
              <select
                value={translationSourceLanguage}
                aria-label="Translate from"
                onChange={(event) => onTranslationSourceLanguageChange?.(event.target.value)}
              >
                {translationLanguageOptions.map((option) => (
                  <option value={option.code} key={option.code}>
                    {option.label} ({option.code}) {option.flag}
                  </option>
                ))}
              </select>
            </label>
            <label className="translation-path-field ew-field-scope">
              <span>To</span>
              <select
                value={translationTargetLanguage}
                aria-label="Translate to"
                onChange={(event) => onTranslationTargetLanguageChange?.(event.target.value)}
              >
                <option value="">Choose language</option>
                {translationLanguageOptions.map((option) => (
                  <option value={option.code} key={option.code}>
                    {option.label} ({option.code}) {option.flag}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
      {deckTranslationStatus ? (
        <div className="deck-translation-status" role="status" aria-live="polite">
          <span className="deck-translation-status-orbit" aria-hidden="true" />
          <span className="ew-truncate">{deckTranslationStatus}</span>
        </div>
      ) : null}
    </>
  );
}
