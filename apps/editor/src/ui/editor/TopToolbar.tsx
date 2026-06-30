import { useEffect, useRef, useState } from 'react';
import type { ProjectDocument } from '../../domain/model';

interface TopToolbarProps {
  project: ProjectDocument;
  language: string;
  languageFlag?: string;
  languageLabel?: string;
  canRedo?: boolean;
  canUndo?: boolean;
  hasSelection?: boolean;
  persistenceEnabled?: boolean;
  persistenceAvailable?: boolean;
  lastEditedAt?: string | undefined;
  saveAnimationKey?: number;
  canTranslateDeck?: boolean;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onImportProject?: (() => void) | undefined;
  onOpenVersionHistory?: (() => void) | undefined;
  onNewProject?: (() => void) | undefined;
  onPersistenceToggle?: ((enabled: boolean) => void) | undefined;
  onProjectNameChange?: ((name: string) => void) | undefined;
  onRedo?: (() => void) | undefined;
  onResetZoom?: (() => void) | undefined;
  onSelectLayers?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onTranslateDeck?: (() => void) | undefined;
  onUndo?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
}

type HeaderMenu = 'File' | 'Edit' | 'View' | 'Help';

interface HeaderMenuAction {
  label: string;
  disabled?: boolean;
  onSelect?: (() => void) | undefined;
}

const menuLabels: HeaderMenu[] = ['File', 'Edit', 'View', 'Help'];

export function TopToolbar({
  project,
  language,
  languageFlag = '🇧🇷',
  languageLabel = language,
  canRedo = false,
  canUndo = false,
  hasSelection = false,
  persistenceEnabled = false,
  persistenceAvailable = true,
  lastEditedAt,
  saveAnimationKey = 0,
  canTranslateDeck = false,
  onDelete,
  onDuplicate,
  onImportProject,
  onOpenVersionHistory,
  onNewProject,
  onPersistenceToggle,
  onProjectNameChange,
  onRedo,
  onResetZoom,
  onSelectLayers,
  onShare,
  onTranslateDeck,
  onUndo,
  onZoomIn,
  onZoomOut,
}: TopToolbarProps) {
  const [openMenu, setOpenMenu] = useState<HeaderMenu | null>(null);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(project.name);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingProjectName) return;

    projectNameInputRef.current?.focus();
    projectNameInputRef.current?.select();
  }, [isEditingProjectName]);

  function triggerShare() {
    if (onShare) {
      onShare();
      return;
    }

    window.alert(`Share wiring ready for ${project.name}`);
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  function commitProjectName() {
    const nextName = projectNameDraft.trim();
    if (nextName && nextName !== project.name) {
      onProjectNameChange?.(nextName);
    }
    setIsEditingProjectName(false);
  }

  const menuActions: Record<HeaderMenu, HeaderMenuAction[]> = {
    File: [
      { label: 'New Project', disabled: !onNewProject, onSelect: onNewProject },
      { label: 'Import Project', disabled: !onImportProject, onSelect: onImportProject },
      {
        label: 'Save Local',
        disabled: !persistenceAvailable,
        onSelect: () => onPersistenceToggle?.(true),
      },
      { label: 'Share', onSelect: triggerShare },
    ],
    Edit: [
  { label: 'Undo', disabled: !canUndo, onSelect: onUndo },
      { label: 'Redo', disabled: !canRedo, onSelect: onRedo },
      { label: 'Duplicate', disabled: !hasSelection, onSelect: onDuplicate },
      { label: 'Delete', disabled: !hasSelection, onSelect: onDelete },
      { label: 'Translate Deck', disabled: !canTranslateDeck || !onTranslateDeck, onSelect: onTranslateDeck },
    ],
    View: [
      { label: 'Zoom Out', disabled: !onZoomOut, onSelect: onZoomOut },
      { label: '100%', disabled: !onResetZoom, onSelect: onResetZoom },
      { label: 'Zoom In', disabled: !onZoomIn, onSelect: onZoomIn },
      onSelectLayers
        ? { label: 'Toggle Layers Panel', onSelect: onSelectLayers }
        : { label: 'Toggle Layers Panel', disabled: true },
    ],
    Help: [
      { label: 'Keyboard Shortcuts', disabled: true },
      { label: 'Local AI Setup', disabled: true },
    ],
  };

  function handleMenuAction(action: HeaderMenuAction) {
    if (action.disabled) return;
    action.onSelect?.();
    closeMenu();
  }

  const lastEditedLabel = lastEditedAt
    ? `Last edited ${new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(lastEditedAt))}`
    : 'No saved versions yet';
  const persistenceLabel = !persistenceAvailable
    ? 'Persistence unavailable'
    : persistenceEnabled
      ? 'Persistence enabled'
      : 'Persistence disabled';
  const persistenceTitle = !persistenceAvailable
    ? 'Local project persistence is not available in this browser. Use a browser with File System Access support.'
    : persistenceEnabled
      ? 'Persistence enabled'
      : 'Persistence disabled';

  return (
    <header className="top-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-product-title font-orbitron">LocalStudio.ai</h1>
        <nav className="toolbar-menu" aria-label="Application menu">
          {menuLabels.map((item) => (
            <div className="toolbar-menu-shell" key={item}>
              <button
                aria-expanded={openMenu === item}
                className={
                  openMenu === item
                    ? 'toolbar-menu-item toolbar-menu-item-active font-orbitron'
                    : 'toolbar-menu-item font-orbitron'
                }
                type="button"
                onClick={() => {
                  setOpenMenu((current) => (current === item ? null : item));
                }}
              >
                {item}
              </button>
              {openMenu === item ? (
                <div className="toolbar-dropdown" role="menu" aria-label={`${item} menu`}>
                  {menuActions[item].map((action) => (
                    <button
                      className="toolbar-dropdown-item"
                      disabled={action.disabled}
                      key={action.label}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        handleMenuAction(action);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="toolbar-divider toolbar-divider-menu" />
        <div className="project-group">
          {isEditingProjectName ? (
            <input
              aria-label="Project name"
              className="project-title-input"
              ref={projectNameInputRef}
              value={projectNameDraft}
              onBlur={commitProjectName}
              onChange={(event) => {
                setProjectNameDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setProjectNameDraft(project.name);
                  setIsEditingProjectName(false);
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitProjectName();
                }
              }}
            />
          ) : (
            <button
              className="project-title project-title-button"
              title={project.name}
              type="button"
              aria-label={`Edit project name ${project.name}`}
              onClick={() => {
                setProjectNameDraft(project.name);
                setIsEditingProjectName(true);
              }}
            >
              {project.name}
            </button>
          )}
          <span className="local-only-badge">Local only</span>
        </div>
      </div>
      <div className="toolbar-right">
        <div className="toolbar-icon-group" aria-label="Editing actions">
          <button
            className={
              !persistenceAvailable
                ? 'stitch-icon-button persistence-off persistence-unavailable'
                : persistenceEnabled
                  ? 'stitch-icon-button persistence-on'
                  : 'stitch-icon-button persistence-off'
            }
            disabled={!persistenceAvailable}
            title={persistenceTitle}
            type="button"
            aria-label={persistenceLabel}
            onClick={() => {
              if (!persistenceAvailable) return;
              onPersistenceToggle?.(!persistenceEnabled);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {persistenceEnabled ? 'cloud_done' : 'cloud_off'}
            </span>
            {!persistenceAvailable ? (
              <span className="persistence-unavailable-x" aria-hidden="true">
                ×
              </span>
            ) : null}
          </button>
          <button
            className="stitch-icon-button history-save-applied"
            disabled={!persistenceEnabled || !onOpenVersionHistory}
            title={lastEditedLabel}
            type="button"
            aria-label="Version history"
            onClick={onOpenVersionHistory}
          >
            <span className="material-symbols-outlined" aria-hidden="true" key={saveAnimationKey}>
              history
            </span>
          </button>
          <button
            className="stitch-icon-button"
            disabled={!canUndo}
            title="Undo"
            type="button"
            aria-label="Undo"
            onClick={onUndo}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              undo
            </span>
          </button>
          <button
            className="stitch-icon-button"
            disabled={!canRedo}
            title="Redo"
            type="button"
            aria-label="Redo"
            onClick={onRedo}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              redo
            </span>
          </button>
        </div>
        <button className="language-chip" type="button" aria-label={`Current slide language ${languageLabel}`}>
          <span className="language-flag" aria-hidden="true">
            {languageFlag}
          </span>
          <span>{language}</span>
        </button>
        <button className="export-button font-orbitron" type="button" onClick={triggerShare}>
          <span className="material-symbols-outlined" aria-hidden="true">
            ios_share
          </span>
          <span>Share</span>
        </button>
        <button className="profile-avatar" type="button" aria-label="User profile">
          <span className="profile-avatar-core" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
