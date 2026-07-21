interface KeyboardShortcutsDialogProps {
  onShortcutAction?: (action: KeyboardShortcutAction) => void;
  onClose: () => void;
  shortcutGroups?: readonly KeyboardShortcutGroup[];
  supportedActions?: readonly KeyboardShortcutAction[];
  title?: string;
  variant?: 'dialog' | 'popover';
}

export type KeyboardShortcutAction =
  | 'black-screen'
  | 'close-slide-navigator'
  | 'cursor-toggle'
  | 'decrease-notes'
  | 'fast-forward-movie'
  | 'first-slide'
  | 'increase-notes'
  | 'jump-movie-end'
  | 'jump-movie-start'
  | 'last-slide'
  | 'next-build'
  | 'next-navigator-slide'
  | 'next-slide'
  | 'open-slide-navigator'
  | 'pause-presentation'
  | 'play-pause-movie'
  | 'previous-build'
  | 'previous-navigator-slide'
  | 'previous-slide'
  | 'quit-presentation'
  | 'reset-timer'
  | 'rewind-movie'
  | 'select-navigator-slide'
  | 'shortcut-toggle'
  | 'show-slide-number'
  | 'white-screen'
  | 'scroll-notes-up'
  | 'scroll-notes-down';

export interface KeyboardShortcutGroup {
  title: string;
  items: { action: KeyboardShortcutAction; keys: string[]; label: string }[];
}

const defaultShortcutGroups = [
  {
    title: 'Navigation',
    items: [
      { action: 'next-build', keys: ['→', '↓'], label: 'Advance to next build' },
      { action: 'previous-build', keys: ['['], label: 'Go back to previous build' },
      { action: 'next-build', keys: [']'], label: 'Advance and skip build' },
      { action: 'next-slide', keys: ['Shift', '↓'], label: 'Advance to next slide' },
      { action: 'previous-slide', keys: ['←', '↑'], label: 'Go back to previous slide' },
      { action: 'first-slide', keys: ['Home'], label: 'Go to first slide' },
      { action: 'last-slide', keys: ['End'], label: 'Go to last slide' },
    ],
  },
  {
    title: 'Other',
    items: [
      { action: 'quit-presentation', keys: ['Esc'], label: 'Quit presentation mode' },
      { action: 'shortcut-toggle', keys: ['?'], label: 'Show or hide Keyboard Shortcuts window' },
      { action: 'pause-presentation', keys: ['F'], label: 'Pause presentation; press any key to resume' },
      { action: 'black-screen', keys: ['B'], label: 'Pause presentation and show black screen' },
      { action: 'white-screen', keys: ['W'], label: 'Pause presentation and show white screen' },
      { action: 'cursor-toggle', keys: ['C'], label: 'Show or hide the pointer cursor' },
      { action: 'show-slide-number', keys: ['S'], label: 'Display the current slide number' },
    ],
  },
  {
    title: 'Slide Navigator',
    items: [
      { action: 'open-slide-navigator', keys: ['#'], label: 'Open the slide navigator' },
      { action: 'next-navigator-slide', keys: ['+'], label: 'Go to the next slide in the slide navigator' },
      { action: 'previous-navigator-slide', keys: ['-'], label: 'Go to the previous slide in the slide navigator' },
      { action: 'select-navigator-slide', keys: ['Return'], label: 'Go to the current slide in the slide navigator' },
      { action: 'close-slide-navigator', keys: ['Esc'], label: 'Close the slide navigator' },
    ],
  },
  {
    title: 'Presenter Display',
    items: [
      { action: 'reset-timer', keys: ['R'], label: 'Reset timer' },
      { action: 'scroll-notes-up', keys: ['U'], label: 'Scroll notes up' },
      { action: 'scroll-notes-down', keys: ['D'], label: 'Scroll notes down' },
      { action: 'increase-notes', keys: ['⌘', '+'], label: 'Increase note font size' },
      { action: 'decrease-notes', keys: ['⌘', '-'], label: 'Decrease note font size' },
    ],
  },
  {
    title: 'Movies',
    items: [
      { action: 'play-pause-movie', keys: ['K'], label: 'Pause/Play movie' },
      { action: 'rewind-movie', keys: ['J'], label: 'Hold to rewind movie' },
      { action: 'fast-forward-movie', keys: ['L'], label: 'Hold to fast forward movie' },
      { action: 'jump-movie-start', keys: ['I'], label: 'Jump to beginning of movie' },
      { action: 'jump-movie-end', keys: ['O'], label: 'Jump to end of movie' },
    ],
  },
] satisfies KeyboardShortcutGroup[];

export function KeyboardShortcutsDialog({
  onShortcutAction,
  onClose,
  shortcutGroups = defaultShortcutGroups,
  supportedActions,
  title = 'Keyboard Shortcuts',
  variant = 'dialog',
}: KeyboardShortcutsDialogProps) {
  const supportedActionSet = supportedActions ? new Set(supportedActions) : undefined;
  const visibleGroups = shortcutGroups
    .map((group) => ({
      ...group,
      items: supportedActionSet
        ? group.items.filter((item) => supportedActionSet.has(item.action))
        : group.items,
    }))
    .filter((group) => group.items.length > 0);
  const content = (
      <section
        className={variant === 'popover' ? 'keyboard-shortcuts-popover' : 'keyboard-shortcuts-dialog'}
        role="dialog"
        aria-modal={variant === 'dialog'}
        aria-labelledby="keyboard-shortcuts-title"
      >
        <button
          className="stitch-icon-button keyboard-shortcuts-close"
          type="button"
          aria-label="Close keyboard shortcuts"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
        <h2 id="keyboard-shortcuts-title">{title}</h2>
        <div className="keyboard-shortcuts-grid">
          {visibleGroups.map((group) => (
            <section className="keyboard-shortcuts-group" key={group.title}>
              <h3>{group.title}</h3>
              <div className="keyboard-shortcuts-list">
                {group.items.map((item) => (
                  <button
                    className="keyboard-shortcuts-row"
                    key={`${group.title}-${item.label}`}
                    type="button"
                    onClick={() => onShortcutAction?.(item.action)}
                  >
                    <span className="keyboard-shortcuts-keys">
                        {item.keys.map((key) => (
                          <kbd key={key}>{key}</kbd>
                        ))}
                    </span>
                    <span className="keyboard-shortcuts-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
  );

  if (variant === 'popover') return content;

  return (
    <div className="keyboard-shortcuts-backdrop" role="presentation">
      {content}
    </div>
  );
}
