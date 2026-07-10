import { ImagePlus, Mic, Plus, SendHorizontal, Square, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { IconButton } from '../../components/IconButton';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { promptRecipes } from './promptRecipes';

interface PromptBarProps {
  createImageNotice?: string | undefined;
  createImageStatus?: string | undefined;
  generationNotice?: string | undefined;
  generationStatus?: string | undefined;
  isGeneratingImage?: boolean;
  isGeneratingSlide?: boolean;
  selectedImageElementId?: string | undefined;
  createImageOptions: CreateImagePromptOptions;
  onCreateImagePromptIntent?: () => boolean | Promise<boolean>;
  onCreateImageSubmit?: (prompt: string, options: CreateImagePromptOptions) => Promise<void>;
  onSlidePromptSubmit?: (prompt: string) => Promise<void>;
  onStopGeneration?: () => void;
}

export function PromptBar({
  createImageNotice,
  createImageStatus,
  generationNotice,
  generationStatus,
  isGeneratingImage = false,
  isGeneratingSlide,
  selectedImageElementId,
  createImageOptions,
  onCreateImagePromptIntent,
  onCreateImageSubmit,
  onSlidePromptSubmit,
  onStopGeneration,
}: PromptBarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'create-image' | null>('create-image');
  const [localSubmissionActive, setLocalSubmissionActive] = useState(false);
  const [value, setValue] = useState('');
  const activeMode = selectedImageElementId ? 'create-image' : mode;
  const examples =
    activeMode === 'create-image'
      ? promptRecipes.imagePromptExamples
      : promptRecipes.slidePromptExamples;
  const isProcessing = isGeneratingSlide || isGeneratingImage || localSubmissionActive;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = '0px';
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 18), 112)}px`;
  }, [value]);

  function activateCreateImageMode() {
    setMode('create-image');
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  async function guardPromptIntent() {
    if (activeMode !== 'create-image') return true;
    return onCreateImagePromptIntent?.() ?? true;
  }

  async function submitPrompt() {
    const trimmedValue = value.trim();
    if (!trimmedValue || isProcessing) return;
    setLocalSubmissionActive(true);
    if (activeMode === 'create-image') {
      try {
        const canCreateImage = await guardPromptIntent();
        if (!canCreateImage) return;
        await onCreateImageSubmit?.(trimmedValue, createImageOptions);
        setValue('');
      } finally {
        setLocalSubmissionActive(false);
      }
      return;
    }
    try {
      await onSlidePromptSubmit?.(trimmedValue);
      setValue('');
    } finally {
      setLocalSubmissionActive(false);
    }
  }

  return (
    <div className="prompt-stack" data-tour-id="prompt-workflow">
      <div
        className="prompt-examples"
        aria-label={
          activeMode === 'create-image' ? 'Image prompt examples' : 'Slide prompt examples'
        }
        data-tour-id="prompt-examples"
      >
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
      {activeMode === 'create-image' && createImageStatus ? (
        <div className="prompt-generation-status">{createImageStatus}</div>
      ) : null}
      {activeMode !== 'create-image' && generationStatus ? (
        <div className="prompt-generation-status">{generationStatus}</div>
      ) : null}
      {activeMode === 'create-image' && createImageNotice ? (
        <div className="prompt-generation-notice" role="tooltip">
          {createImageNotice}
        </div>
      ) : null}
      {activeMode !== 'create-image' && generationNotice ? (
        <div className="prompt-generation-notice" role="tooltip">
          {generationNotice}
        </div>
      ) : null}
      <form
        className={isProcessing ? 'prompt-bar prompt-bar-processing' : 'prompt-bar'}
        aria-busy={isProcessing}
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
            data-tour-id="prompt-actions"
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
        <div className="prompt-input-cluster ew-compact-row">
          {activeMode === 'create-image' ? (
            <button
              aria-label="Remove Create image mode"
              className="prompt-mode-token"
              data-tour-id="prompt-create-image-token"
              disabled={isProcessing || Boolean(selectedImageElementId)}
              type="button"
              onClick={() => {
                setMode(null);
                inputRef.current?.focus();
              }}
            >
              <ImagePlus size={15} />
              <span className="ew-truncate">Create image</span>
              <X className="prompt-mode-token-close" size={13} />
            </button>
          ) : null}
          <textarea
            ref={inputRef}
            placeholder={
              activeMode === 'create-image'
                ? ''
                : 'Describe slide structure or organize current content...'
            }
            aria-label={
              activeMode === 'create-image' ? 'Create image prompt' : 'Slide structure prompt'
            }
            disabled={isProcessing}
            rows={1}
            value={value}
            onFocus={() => {
              void guardPromptIntent();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitPrompt();
              }
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (
                activeMode === 'create-image' &&
                !selectedImageElementId &&
                value.length > 0 &&
                nextValue.length === 0
              ) {
                setMode(null);
                setValue('');
                return;
              }

              setValue(nextValue);
              void guardPromptIntent();
            }}
          />
        </div>
        <div className="prompt-submit-actions" data-tour-id="prompt-submit-actions">
          <IconButton disabled={isProcessing} label="Record voice prompt">
            <Mic size={16} />
          </IconButton>
          {isProcessing ? (
            <IconButton
              label="Stop generation"
              tone="danger"
              onClick={() => {
                setLocalSubmissionActive(false);
                setValue('');
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
        </div>
      </form>
    </div>
  );
}
