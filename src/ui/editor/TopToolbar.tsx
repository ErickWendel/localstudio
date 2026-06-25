import { useState } from 'react';
import type { ProjectDocument } from '../../domain/model';

interface TopToolbarProps {
  project: ProjectDocument;
  language: string;
  canRedo?: boolean;
  canUndo?: boolean;
  hasSelection?: boolean;
  persistenceEnabled?: boolean;
  zoomPercent?: number;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onRedo?: () => void;
  onResetZoom?: () => void;
  onSelectLayers?: () => void;
  onUndo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
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
  canRedo = false,
  canUndo = false,
  hasSelection = false,
  persistenceEnabled = false,
  zoomPercent = 100,
  onDelete,
  onDuplicate,
  onExport,
  onRedo,
  onResetZoom,
  onSelectLayers,
  onUndo,
  onZoomIn,
  onZoomOut,
}: TopToolbarProps) {
  const [openMenu, setOpenMenu] = useState<HeaderMenu | null>(null);

  function triggerExport() {
    if (onExport) {
      onExport();
      return;
    }

    window.alert(`Export PNG/PDF wiring ready for ${project.name}`);
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  const menuActions: Record<HeaderMenu, HeaderMenuAction[]> = {
    File: [
      { label: 'New Project', disabled: true },
      { label: 'Save Local', disabled: true },
      { label: 'Export', onSelect: triggerExport },
    ],
    Edit: [
      { label: 'Undo', disabled: !canUndo, onSelect: onUndo },
      { label: 'Redo', disabled: !canRedo, onSelect: onRedo },
      { label: 'Duplicate', disabled: !hasSelection, onSelect: onDuplicate },
      { label: 'Delete', disabled: !hasSelection, onSelect: onDelete },
    ],
    View: [
      { label: 'Zoom Out', onSelect: onZoomOut },
      { label: '100%', onSelect: onResetZoom },
      { label: 'Zoom In', onSelect: onZoomIn },
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

  return (
    <header className="top-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-product-title font-orbitron">EW Canvas AI</h1>
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
          <span className="project-title" title={project.name}>
            {project.name}
          </span>
          <span className="local-only-badge">Local only</span>
        </div>
      </div>
      <div className="toolbar-right">
        <div className="toolbar-icon-group" aria-label="Editing actions">
          <button
            className={persistenceEnabled ? 'stitch-icon-button persistence-on' : 'stitch-icon-button persistence-off'}
            disabled
            title={persistenceEnabled ? 'Persistence enabled' : 'Persistence disabled'}
            type="button"
            aria-label={persistenceEnabled ? 'Persistence enabled' : 'Persistence disabled'}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {persistenceEnabled ? 'cloud_done' : 'cloud_off'}
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
        <div className="toolbar-divider" />
        <div className="zoom-group" aria-label="Zoom controls">
          <button
            className="stitch-icon-button"
            disabled={zoomPercent <= 50}
            title="Zoom Out"
            type="button"
            aria-label="Zoom Out"
            onClick={onZoomOut}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              remove
            </span>
          </button>
          <button className="zoom-value" type="button" aria-label="Reset zoom" onClick={onResetZoom}>
            {zoomPercent}%
          </button>
          <button
            className="stitch-icon-button"
            disabled={zoomPercent >= 200}
            title="Zoom In"
            type="button"
            aria-label="Zoom In"
            onClick={onZoomIn}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              zoom_in
            </span>
          </button>
        </div>
        <button className="language-chip" type="button" aria-label={`Current language ${language}`}>
          <span className="language-flag" aria-hidden="true">
            🇧🇷
          </span>
          <span>{language}</span>
        </button>
        <button className="export-button font-orbitron" type="button" onClick={triggerExport}>
          <span className="material-symbols-outlined" aria-hidden="true">
            ios_share
          </span>
          <span>Export</span>
        </button>
        <button className="profile-avatar" type="button" aria-label="User profile">
          <span className="profile-avatar-core" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
