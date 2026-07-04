interface ToolbarAction {
  label: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  display?: 'icon' | 'label';
  onClick?: (() => void) | undefined;
  tone?: 'default' | 'ai' | 'danger';
}

interface FloatingSelectionToolbarProps {
  elementType?: 'gif' | 'image' | 'shape' | 'text' | 'video' | undefined;
  onAlignCenter?: (() => void) | undefined;
  onBringForward?: (() => void) | undefined;
  onBackgroundSelectionToggle?: (() => void) | undefined;
  onCropImage?: (() => void) | undefined;
  onFlipImage?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onOpenAnimations?: (() => void) | undefined;
  onSendBackward?: (() => void) | undefined;
  onTranslateSelectedText?: (() => void) | undefined;
  backgroundSelectionActive?: boolean;
  cropActive?: boolean;
  canTranslateSelection?: boolean;
  disabled?: boolean;
}

export function FloatingSelectionToolbar({
  elementType,
  onAlignCenter,
  onBackgroundSelectionToggle,
  onBringForward,
  onCropImage,
  onFlipImage,
  onDelete,
  onDuplicate,
  onOpenAnimations,
  onSendBackward,
  onTranslateSelectedText,
  backgroundSelectionActive = false,
  cropActive = false,
  canTranslateSelection = false,
  disabled = false,
}: FloatingSelectionToolbarProps) {
  const imageGroups: ToolbarAction[][] = [
    [
      {
        label: backgroundSelectionActive ? 'Cancel BG Remover' : 'BG Remover',
        icon: backgroundSelectionActive ? 'ads_click' : 'auto_fix_high',
        active: backgroundSelectionActive,
        display: 'label',
        onClick: onBackgroundSelectionToggle,
        tone: 'ai',
      },
      { label: 'Flip', icon: 'flip', display: 'label', onClick: onFlipImage },
      {
        label: cropActive ? 'Done' : 'Crop',
        icon: cropActive ? 'check' : 'crop',
        active: cropActive,
        disabled: !onCropImage,
        display: 'label',
        onClick: onCropImage,
      },
    ],
    [
      { label: 'Align Center', icon: 'align_horizontal_center', onClick: onAlignCenter },
      { label: 'Send Backward', icon: 'flip_to_back', onClick: onSendBackward },
      { label: 'Bring Forward', icon: 'flip_to_front', onClick: onBringForward },
    ],
    [
      { label: 'Animate', icon: 'animation', display: 'label', onClick: onOpenAnimations },
      { label: 'Duplicate', icon: 'content_copy', onClick: onDuplicate },
      { label: 'Delete', icon: 'delete', onClick: onDelete, tone: 'danger' },
    ],
  ];

  const objectGroups: ToolbarAction[][] = [
    [{ label: 'Align Center', icon: 'align_horizontal_center', onClick: onAlignCenter }],
    [
      { label: 'Bring Forward', icon: 'flip_to_front', onClick: onBringForward },
      { label: 'Send Backward', icon: 'flip_to_back', onClick: onSendBackward },
    ],
    [
      { label: 'Animate', icon: 'animation', display: 'label', onClick: onOpenAnimations },
      { label: 'Duplicate', icon: 'content_copy', onClick: onDuplicate },
      { label: 'Lock', icon: 'lock' },
    ],
    [
      {
        label: 'Translate Selected Text',
        icon: 'translate',
        onClick: onTranslateSelectedText,
        tone: 'ai',
        disabled: !canTranslateSelection,
      },
    ],
    [{ label: 'Delete', icon: 'delete', onClick: onDelete, tone: 'danger' }],
  ];

  const groups = elementType === 'image' ? imageGroups : objectGroups;

  return (
    <div className="floating-toolbar" aria-label="Selected element actions">
      {groups.map((group, groupIndex) => (
        <div
          className="floating-toolbar-group ew-inline-row-tight"
          key={group.map((item) => item.label).join('-')}
        >
          {groupIndex > 0 ? <span className="floating-toolbar-divider" aria-hidden="true" /> : null}
          {group.map((action) => (
            <button
              className={`floating-toolbar-button floating-toolbar-button-${action.tone ?? 'default'}${
                action.active ? ' floating-toolbar-button-active' : ''
              }`}
              key={action.label}
              title={action.label}
              aria-label={action.label}
              disabled={disabled || action.disabled}
              type="button"
              onClick={action.onClick}
            >
              <span className="material-symbols-outlined">{action.icon}</span>
              {action.display === 'label' ? (
                <span className="floating-toolbar-label">{action.label}</span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
