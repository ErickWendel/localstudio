interface ToolbarAction {
  label: string;
  icon: string;
  onClick?: (() => void) | undefined;
  tone?: 'default' | 'ai' | 'danger';
}

interface FloatingSelectionToolbarProps {
  onAlignCenter?: (() => void) | undefined;
  onBringForward?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onSendBackward?: (() => void) | undefined;
}

export function FloatingSelectionToolbar({
  onAlignCenter,
  onBringForward,
  onDelete,
  onDuplicate,
  onSendBackward,
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
      { label: 'Remove Background', icon: 'no_photography', tone: 'ai' },
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
              className={`floating-toolbar-button floating-toolbar-button-${action.tone ?? 'default'}`}
              key={action.label}
              title={action.label}
              aria-label={action.label}
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
