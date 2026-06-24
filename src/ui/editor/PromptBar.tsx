import { Mic, SendHorizontal, Sparkles } from 'lucide-react';
import { IconButton } from '../components/IconButton';

export function PromptBar() {
  return (
    <form className="prompt-bar" aria-label="Slide structure prompt">
      <Sparkles size={18} aria-hidden="true" />
      <input
        type="text"
        placeholder="Describe slide structure or organize current content..."
        aria-label="Slide structure prompt"
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
