interface SlideCopyControlProps {
  canCopy: boolean;
  label: string;
  onCopy?: (() => void) | undefined;
  onSaveLocal?: (() => void) | undefined;
}

const slideCopyHint = {
  blocked:
    'Store this project locally before copying slides. Unsaved assets can paste empty in another tab.',
  unavailable:
    'Store this project locally before copying slides. Local storage is not available in this browser.',
} as const;

export function SlideCopyControl({ canCopy, label, onCopy, onSaveLocal }: SlideCopyControlProps) {
  if (canCopy) {
    return (
      <button
        className="icon-button"
        type="button"
        aria-label={label}
        disabled={!onCopy}
        title={label}
        onClick={onCopy}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          file_copy
        </span>
      </button>
    );
  }

  const hint = onSaveLocal ? slideCopyHint.blocked : slideCopyHint.unavailable;
  return (
    <span className="slide-copy-control">
      <button
        className="icon-button"
        type="button"
        disabled
        aria-label={label}
        title={hint}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          file_copy
        </span>
      </button>
      <span className="slide-copy-control-tooltip" aria-hidden="true">
        {hint}
      </span>
      {onSaveLocal ? (
        <button className="slide-copy-save-now" type="button" title={hint} onClick={onSaveLocal}>
          Save now
        </button>
      ) : null}
    </span>
  );
}
