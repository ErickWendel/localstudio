interface ToolbarAction {
  label: string;
  icon: string;
  active?: boolean;
  onClick?: (() => void) | undefined;
  tone?: 'default' | 'ai' | 'danger';
}

interface FloatingSelectionToolbarProps {
  onAlignCenter?: (() => void) | undefined;
  onBringForward?: (() => void) | undefined;
  onBackgroundSelectionToggle?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onSendBackward?: (() => void) | undefined;
  backgroundSelectionActive?: boolean;
  disabled?: boolean;
}

export function FloatingSelectionToolbar({
  onAlignCenter,
  onBackgroundSelectionToggle,
  onBringForward,
  onDelete,
  onDuplicate,
  onSendBackward,
  backgroundSelectionActive = false,
  disabled = false,
}: FloatingSelectionToolbarProps) {
  const groups: ToolbarAction[][] = [
    [{ label: 'Align Center', icon: 'align_horizontal_center', onClick: onAlignCenter }],
    [
      { label: 'Bring Forward', icon: 'flip_to_front', onClick: onBringForward },
      { label: 'Send Backward', icon: 'flip_to_back', onClick: onSendBackward },
    ],
    [
      { label: 'Duplicate', icon: 'content_copy', onClick: onDuplicate },
      { label: 'Lock', icon: 'lock' },
    ],
    [
      {
        label: backgroundSelectionActive ? 'Cancel Background Selection' : 'Remove Background',
        icon: backgroundSelectionActive ? 'ads_click' : 'no_photography',
        active: backgroundSelectionActive,
        onClick: onBackgroundSelectionToggle,
        tone: 'ai',
      },
      { label: 'Translate This Design', icon: 'translate', tone: 'ai' },
    ],
    [{ label: 'Delete', icon: 'delete', onClick: onDelete, tone: 'danger' }],
  ];

  return (
    <div className="floating-toolbar" aria-label="Selected element actions">
      {groups.map((group, groupIndex) => (
        <div className="floating-toolbar-group" key={group.map((item) => item.label).join('-')}>
          {groupIndex > 0 ? <span className="floating-toolbar-divider" aria-hidden="true" /> : null}
          {group.map((action) => (
            <button
              className={`floating-toolbar-button floating-toolbar-button-${action.tone ?? 'default'}${
                action.active ? ' floating-toolbar-button-active' : ''
              }`}
              key={action.label}
              title={action.label}
              aria-label={action.label}
              disabled={disabled}
              type="button"
              onClick={action.onClick}
            >
              <span className="material-symbols-outlined">{action.icon}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
