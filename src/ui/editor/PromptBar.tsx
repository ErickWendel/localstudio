import { ImagePlus, Mic, Plus, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../components/IconButton';

interface PromptBarProps {
  onCreateImagePromptIntent?: () => Promise<boolean>;
}

export function PromptBar({ onCreateImagePromptIntent }: PromptBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'create-image' | null>(null);
  const [value, setValue] = useState('');

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

  return (
    <form
      className="prompt-bar"
      aria-label="Slide structure prompt"
      onSubmit={(event) => {
        event.preventDefault();
        void guardPromptIntent();
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
      <IconButton label="Submit prompt">
        <SendHorizontal size={16} />
      </IconButton>
    </form>
  );
}
