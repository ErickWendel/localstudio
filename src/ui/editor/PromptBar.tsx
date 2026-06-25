import { ImagePlus, Mic, Plus, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../components/IconButton';

interface PromptBarProps {
  createImageNotice?: string | undefined;
  createImageStatus?: string | undefined;
  generationNotice?: string | undefined;
  generationStatus?: string | undefined;
  isGeneratingImage?: boolean;
  isGeneratingSlide?: boolean;
  onCreateImagePromptIntent?: () => boolean | Promise<boolean>;
  onCreateImageSubmit?: (prompt: string) => Promise<void>;
  onSlidePromptSubmit?: (prompt: string) => Promise<void>;
}

const slidePromptExamples = [
  'A slide with the title Why Web AI Matters and a subtitle about private AI running in the browser',
  'A slide with a placeholder image on the left, the title Local AI Is Faster in the middle, and subtext below',
  'A slide with a large centered title Web AI Benefits, two bullet points about privacy and offline use, and a footer note',
  'A slide with three columns about Web AI: Privacy, Speed, and No Backend, each with an icon placeholder and one sentence',
  'A slide with a black background, green title Run AI Directly In The Browser, short subtitle, and a call-to-action button',
];

const imagePromptExamples = [
  'An icy Bonsai tree, in a rainy forest with snowy mountains in the background, photo realistic',
  'A neon green browser-native design studio floating inside a dark futuristic workspace',
  'A cinematic close-up of a laptop editing slides with glowing green UI reflections',
  'A realistic product hero image for a local-first AI creative editor, dark background',
  'A cyberpunk classroom with holographic slide canvases and black-and-green lighting',
];

export function PromptBar({
  createImageNotice,
  createImageStatus,
  generationNotice,
  generationStatus,
  isGeneratingImage = false,
  isGeneratingSlide,
  onCreateImagePromptIntent,
  onCreateImageSubmit,
  onSlidePromptSubmit,
}: PromptBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'create-image' | null>(null);
  const [value, setValue] = useState('');
  const examples = mode === 'create-image' ? imagePromptExamples : slidePromptExamples;

  useEffect(() => {
    if (mode !== 'create-image') return;
    inputRef.current?.focus();
  }, [mode]);

  function activateCreateImageMode() {
    setMode('create-image');
    setMenuOpen(false);
  }

  async function guardPromptIntent() {
    if (mode !== 'create-image') return true;
    return onCreateImagePromptIntent?.() ?? true;
  }

  async function submitPrompt() {
    const trimmedValue = value.trim();
    if (!trimmedValue || isGeneratingSlide || isGeneratingImage) return;
    if (mode === 'create-image') {
      const canCreateImage = await guardPromptIntent();
      if (!canCreateImage) return;
      await onCreateImageSubmit?.(trimmedValue);
      return;
    }
    await onSlidePromptSubmit?.(trimmedValue);
  }

  return (
    <div className="prompt-stack">
      <div className="prompt-examples" aria-label={mode === 'create-image' ? 'Image prompt examples' : 'Slide prompt examples'}>
        {examples.map((example) => (
          <button
            key={example}
            className="prompt-example-chip"
            type="button"
            onClick={() => {
              setValue(example);
              inputRef.current?.focus();
              void guardPromptIntent();
            }}
          >
            {example}
          </button>
        ))}
      </div>
      {mode === 'create-image' && createImageStatus ? (
        <div className="prompt-generation-status">{createImageStatus}</div>
      ) : null}
      {mode !== 'create-image' && generationStatus ? (
        <div className="prompt-generation-status">{generationStatus}</div>
      ) : null}
      {mode === 'create-image' && createImageNotice ? (
        <div className="prompt-generation-notice" role="tooltip">
          {createImageNotice}
        </div>
      ) : null}
      {mode !== 'create-image' && generationNotice ? (
        <div className="prompt-generation-notice" role="tooltip">
          {generationNotice}
        </div>
      ) : null}
      <form
        className="prompt-bar"
        aria-label="Slide structure prompt"
        onSubmit={(event) => {
          event.preventDefault();
          void submitPrompt();
        }}
      >
        <div className="prompt-action-shell">
          <button
            aria-expanded={menuOpen}
            aria-label="Prompt actions"
            className="prompt-action-button"
            type="button"
            onClick={() => {
              setMenuOpen((current) => !current);
            }}
          >
            <Plus size={18} />
          </button>
          {menuOpen ? (
            <div className="prompt-action-menu" role="menu">
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  activateCreateImageMode();
                }}
              >
                <ImagePlus size={15} />
                <span>Create image</span>
              </button>
            </div>
          ) : null}
        </div>
        {mode === 'create-image' ? (
          <span className="prompt-mode-token">
            <ImagePlus size={15} />
            Create image
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          placeholder={mode === 'create-image' ? '' : 'Describe slide structure or organize current content...'}
          aria-label={mode === 'create-image' ? 'Create image prompt' : 'Slide structure prompt'}
          value={value}
          onFocus={() => {
            void guardPromptIntent();
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (mode === 'create-image' && value.length > 0 && nextValue.length === 0) {
              setMode(null);
              setValue('');
              return;
            }

            setValue(nextValue);
            void guardPromptIntent();
          }}
        />
        <IconButton label="Record voice prompt">
          <Mic size={16} />
        </IconButton>
        <IconButton
          disabled={isGeneratingSlide || isGeneratingImage}
          label={isGeneratingImage ? 'Generating image' : isGeneratingSlide ? 'Generating slide' : 'Submit prompt'}
          onClick={() => {
            void submitPrompt();
          }}
        >
          <SendHorizontal size={16} />
        </IconButton>
      </form>
    </div>
  );
}
