import { ImagePlus, Mic, Plus, SendHorizontal, Square, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton } from '../components/IconButton';
import type { CreateImagePromptOptions } from './imagePromptOptions';

interface PromptBarProps {
  createImageNotice?: string | undefined;
  createImageStatus?: string | undefined;
  generationNotice?: string | undefined;
  generationStatus?: string | undefined;
  isGeneratingImage?: boolean;
  isGeneratingSlide?: boolean;
  createImageOptions: CreateImagePromptOptions;
  onCreateImagePromptIntent?: () => boolean | Promise<boolean>;
  onCreateImageSubmit?: (prompt: string, options: CreateImagePromptOptions) => Promise<void>;
  onSlidePromptSubmit?: (prompt: string) => Promise<void>;
  onStopGeneration?: () => void;
}

const slidePromptExamples = [
  'Slide with the placeholder image expanded large on the left, the neon green title “AI Design Revolution” on the right, and the subtitle “Browser-native creative” below it.',
  'Three-image grid about Web AI, with matching captions.',
  'Top title and three body bullets about why Web AI is useful.',
  'Slide using https://img-c.udemycdn.com/course/480x270/5625134_794c.jpg as the main image, with a short title and caption.',
  'Slide with a deep purple background, gold title "Web AI Advantage", and white subtitle "Fast local intelligence".',
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
  createImageOptions,
  onCreateImagePromptIntent,
  onCreateImageSubmit,
  onSlidePromptSubmit,
  onStopGeneration,
}: PromptBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'create-image' | null>('create-image');
  const [value, setValue] = useState('');
  const examples = mode === 'create-image' ? imagePromptExamples : slidePromptExamples;
  const isProcessing = isGeneratingSlide || isGeneratingImage;

  function activateCreateImageMode() {
    setMode('create-image');
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  async function guardPromptIntent() {
    if (mode !== 'create-image') return true;
    return onCreateImagePromptIntent?.() ?? true;
  }

  async function submitPrompt() {
    const trimmedValue = value.trim();
    if (!trimmedValue || isProcessing) return;
    if (mode === 'create-image') {
      const canCreateImage = await guardPromptIntent();
      if (!canCreateImage) return;
      setValue('');
      await onCreateImageSubmit?.(trimmedValue, createImageOptions);
      return;
    }
    setValue('');
    await onSlidePromptSubmit?.(trimmedValue);
  }

  return (
    <div className="prompt-stack">
      <div className="prompt-examples" aria-label={mode === 'create-image' ? 'Image prompt examples' : 'Slide prompt examples'}>
        {examples.map((example) => (
          <button
            key={example}
            className="prompt-example-chip"
            disabled={isProcessing}
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
            disabled={isProcessing}
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
          <button
            aria-label="Remove Create image mode"
            className="prompt-mode-token"
            disabled={isProcessing}
            type="button"
            onClick={() => {
              setMode(null);
              inputRef.current?.focus();
            }}
          >
            <ImagePlus size={15} />
            <span>Create image</span>
            <X className="prompt-mode-token-close" size={13} />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          placeholder={mode === 'create-image' ? '' : 'Describe slide structure or organize current content...'}
          aria-label={mode === 'create-image' ? 'Create image prompt' : 'Slide structure prompt'}
          disabled={isProcessing}
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
        <IconButton disabled={isProcessing} label="Record voice prompt">
          <Mic size={16} />
        </IconButton>
        {isProcessing ? (
          <IconButton
            label="Stop generation"
            tone="danger"
            onClick={() => {
              onStopGeneration?.();
            }}
          >
            <Square size={16} />
          </IconButton>
        ) : (
          <IconButton
            label="Submit prompt"
            onClick={() => {
              void submitPrompt();
            }}
          >
            <SendHorizontal size={16} />
          </IconButton>
        )}
      </form>
    </div>
  );
}
