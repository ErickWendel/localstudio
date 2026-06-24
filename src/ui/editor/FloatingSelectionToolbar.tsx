interface ToolbarAction {
  label: string;
  icon: string;
  tone?: 'default' | 'ai' | 'danger';
}

const groups: ToolbarAction[][] = [
  [{ label: 'Align Center', icon: 'align_horizontal_center' }],
  [
    { label: 'Bring Forward', icon: 'flip_to_front' },
    { label: 'Send Backward', icon: 'flip_to_back' },
  ],
  [
    { label: 'Duplicate', icon: 'content_copy' },
    { label: 'Lock', icon: 'lock' },
  ],
  [
    { label: 'Remove Background', icon: 'no_photography', tone: 'ai' },
    { label: 'Translate This Design', icon: 'translate', tone: 'ai' },
  ],
  [{ label: 'Delete', icon: 'delete', tone: 'danger' }],
];

export function FloatingSelectionToolbar() {
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
            >
              <span className="material-symbols-outlined">{action.icon}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
