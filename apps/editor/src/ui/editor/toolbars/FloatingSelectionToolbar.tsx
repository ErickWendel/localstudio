import { useState } from 'react';
import type { AlignMode } from '../../../domain/commands/elements/basicCommands';

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
  onAlign?: ((mode: AlignMode) => void) | undefined;
  onBringForward?: (() => void) | undefined;
  onBackgroundSelectionToggle?: (() => void) | undefined;
  onCropImage?: (() => void) | undefined;
  onFlipImage?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onEditAsGrid?: (() => void) | undefined;
  onOpenAnimations?: (() => void) | undefined;
  onSendBackward?: (() => void) | undefined;
  onTranslateSelectedText?: (() => void) | undefined;
  backgroundSelectionActive?: boolean;
  cropActive?: boolean;
  canTranslateSelection?: boolean;
  disabled?: boolean;
  selectionCount?: number;
}

interface AlignOption {
  icon: string;
  label: string;
  mode: AlignMode;
}

const alignOptions: AlignOption[] = [
  { icon: 'align_horizontal_left', label: 'Center left', mode: 'page-left-center' },
  { icon: 'align_horizontal_center', label: 'Center', mode: 'page-center' },
  { icon: 'align_horizontal_right', label: 'Center right', mode: 'page-right-center' },
  { icon: 'align_vertical_top', label: 'Center top', mode: 'page-top-center' },
  { icon: 'align_vertical_bottom', label: 'Center bottom', mode: 'page-bottom-center' },
];

export function FloatingSelectionToolbar({
  elementType,
  onAlign,
  onBackgroundSelectionToggle,
  onBringForward,
  onCropImage,
  onFlipImage,
  onDelete,
  onDuplicate,
  onEditAsGrid,
  onOpenAnimations,
  onSendBackward,
  onTranslateSelectedText,
  backgroundSelectionActive = false,
  cropActive = false,
  canTranslateSelection = false,
  disabled = false,
  selectionCount = 1,
}: FloatingSelectionToolbarProps) {
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const multiSelectionGroups: ToolbarAction[][] = [
    [
      { label: 'Animate', icon: 'animation', display: 'label', onClick: onOpenAnimations },
      { label: 'Delete', icon: 'delete', onClick: onDelete, tone: 'danger' },
    ],
  ];
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
      { label: 'Align', icon: 'align_horizontal_center', onClick: undefined },
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
    [{ label: 'Align', icon: 'align_horizontal_center', onClick: undefined }],
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

  const groups =
    selectionCount > 1
      ? multiSelectionGroups
      : elementType === 'image'
        ? imageGroups
        : objectGroups;

  return (
    <div className="floating-toolbar" aria-label="Selected element actions">
      {groups.map((group, groupIndex) => (
        <div
          className="floating-toolbar-group ew-inline-row-tight"
          key={group.map((item) => item.label).join('-')}
        >
          {groupIndex > 0 ? <span className="floating-toolbar-divider" aria-hidden="true" /> : null}
          {selectionCount > 1 && groupIndex === 0 ? (
            <>
              <div className="floating-toolbar-menu-shell">
                <button
                  aria-label="Edit as grid"
                  className="floating-toolbar-button"
                  disabled={disabled || !onEditAsGrid}
                  title="Edit as grid"
                  type="button"
                  onClick={onEditAsGrid}
                >
                  <span className="material-symbols-outlined">grid_view</span>
                  <span className="floating-toolbar-label">Edit as grid</span>
                </button>
              </div>
              <span className="floating-toolbar-divider" aria-hidden="true" />
            </>
          ) : null}
          {group.map((action) =>
            action.label === 'Align' ? (
              <AlignDropdown
                disabled={disabled || !onAlign}
                key={action.label}
                menuOpen={alignMenuOpen}
                onAlign={onAlign}
                onOpenChange={setAlignMenuOpen}
              />
            ) : (
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
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function AlignDropdown({
  disabled,
  menuOpen,
  onAlign,
  onOpenChange,
}: {
  disabled: boolean;
  menuOpen: boolean;
  onAlign: ((mode: AlignMode) => void) | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="floating-toolbar-menu-shell">
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Align"
        className="floating-toolbar-button"
        disabled={disabled}
        title="Align"
        type="button"
        onClick={() => {
          onOpenChange(!menuOpen);
        }}
      >
        <span className="material-symbols-outlined">align_horizontal_center</span>
        <span className="material-symbols-outlined floating-toolbar-caret">expand_more</span>
      </button>
      {menuOpen ? (
        <div className="floating-toolbar-align-menu" role="menu">
          {alignOptions.map((option) => (
            <button
              aria-label={option.label}
              className="floating-toolbar-align-option"
              key={option.mode}
              role="menuitem"
              type="button"
              onClick={() => {
                onAlign?.(option.mode);
                onOpenChange(false);
              }}
            >
              <span className="material-symbols-outlined">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
