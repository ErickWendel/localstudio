import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProjectDocument } from '../../../domain/documents/model';
import type { MirrorState } from '../../../services/contracts/interfaces';

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
  publicSharingAvailable?: boolean;
  publicSharingUnavailableReason?: string;
  lastEditedAt?: string | undefined;
  mirrorState?: MirrorState;
  localProjectSetupPanel?: ReactNode;
  persistenceAttention?: boolean;
  persistenceNotice?: string | undefined;
  saveAnimationKey?: number;
  canTranslateDeck?: boolean;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onImportProject?: (() => void) | undefined;
  onImportRemoteMirror?: (() => void) | undefined;
  onMirrorNow?: (() => void) | undefined;
  onMirrorToggle?: ((enabled: boolean) => void) | undefined;
  onOpenVersionHistory?: (() => void) | undefined;
  onNewProject?: (() => void) | undefined;
  onPersistenceToggle?: ((enabled: boolean) => void) | undefined;
  onSaveLocal?: (() => void) | undefined;
  onProjectNameChange?: ((name: string) => void) | undefined;
  onRedo?: (() => void) | undefined;
  onResetZoom?: (() => void) | undefined;
  onSelectLayers?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onStartPresenterMode?: ((options?: { fromBeginning?: boolean }) => void) | undefined;
  onTranslateDeck?: (() => void) | undefined;
  onUndo?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
}

type HeaderMenu = 'File' | 'Edit' | 'View' | 'Help';

interface HeaderMenuActionItem {
  kind?: 'item';
  label: string;
  disabled?: boolean;
  onSelect?: (() => void) | undefined;
}

interface HeaderMenuSeparator {
  kind: 'separator';
  label: string;
}

type HeaderMenuAction = HeaderMenuActionItem | HeaderMenuSeparator;

const menuLabels: HeaderMenu[] = ['File', 'Edit', 'View', 'Help'];
const githubUrl = 'https://github.com/ErickWendel/localstudio';
const githubStarCount = 9999;

function useAnimatedStarCount(target: number) {
  const [count, setCount] = useState(target);

  useEffect(() => {
    const startCount = Math.max(0, target - 999);
    const durationMs = 2800;
    const holdMs = 1400;
    const cycleMs = durationMs + holdMs;
    let animationFrame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) % cycleMs;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startCount + (target - startCount) * easedProgress));

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [target]);

  return count;
}

function GitHubLogo() {
  return (
    <svg className="github-toolbar-logo" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.7 5.47 7.78.4.07.55-.18.55-.39 0-.2-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.15-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.1-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.4 7.4 0 0 1 8 3.99c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .21.15.47.55.39A8.13 8.13 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"
      />
    </svg>
  );
}

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
  publicSharingAvailable = true,
  publicSharingUnavailableReason = 'Public sharing requires active external storage.',
  lastEditedAt,
  mirrorState = { enabled: false, status: 'disabled' },
  localProjectSetupPanel,
  persistenceAttention = false,
  persistenceNotice,
  saveAnimationKey = 0,
  canTranslateDeck = false,
  onDelete,
  onDuplicate,
  onImportProject,
  onImportRemoteMirror,
  onMirrorNow,
  onMirrorToggle,
  onOpenVersionHistory,
  onNewProject,
  onPersistenceToggle,
  onProjectNameChange,
  onRedo,
  onResetZoom,
  onSelectLayers,
  onShare,
  onStartPresenterMode,
  onSaveLocal,
  onTranslateDeck,
  onUndo,
  onZoomIn,
  onZoomOut,
}: TopToolbarProps) {
  const [openMenu, setOpenMenu] = useState<HeaderMenu | null>(null);
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(project.name);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const stars = useAnimatedStarCount(githubStarCount);

  useEffect(() => {
    if (!isEditingProjectName) return;

    projectNameInputRef.current?.focus();
    projectNameInputRef.current?.select();
  }, [isEditingProjectName]);

  function triggerShare() {
    if (!publicSharingAvailable) return;
    onShare?.();
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  function startPresenterMode(options?: { fromBeginning?: boolean }) {
    if (options) {
      onStartPresenterMode?.(options);
    } else {
      onStartPresenterMode?.();
    }
    setPlayMenuOpen(false);
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
      { label: 'Import Remote', disabled: !onImportRemoteMirror, onSelect: onImportRemoteMirror },
      { label: 'Share', disabled: !publicSharingAvailable, onSelect: triggerShare },
      { kind: 'separator', label: 'File storage actions' },
      { label: 'Save', disabled: !onSaveLocal, onSelect: onSaveLocal },
      { label: 'Mirror Now', disabled: !onMirrorNow, onSelect: onMirrorNow },
    ],
    Edit: [
      { label: 'Undo', disabled: !canUndo, onSelect: onUndo },
      { label: 'Redo', disabled: !canRedo, onSelect: onRedo },
      { label: 'Duplicate', disabled: !hasSelection, onSelect: onDuplicate },
      { label: 'Delete', disabled: !hasSelection, onSelect: onDelete },
      {
        label: 'Translate Deck',
        disabled: !canTranslateDeck || !onTranslateDeck,
        onSelect: onTranslateDeck,
      },
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
    if (action.kind === 'separator') return;
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
  const mirrorLabel = !persistenceEnabled
    ? 'Unsaved deck'
    : !mirrorState.enabled
      ? 'Local only'
      : mirrorState.status === 'syncing'
        ? 'Mirroring'
        : mirrorState.status === 'failed'
          ? 'Mirror failed'
          : mirrorState.status === 'synced'
            ? 'Mirrored'
            : 'Local only';
  const mirrorStatusDisabled = !persistenceEnabled;
  const mirrorStatusLabel = mirrorStatusDisabled
    ? 'Mirror disabled'
    : !mirrorState.enabled
      ? 'Mirror disabled'
      : mirrorState.status === 'syncing'
        ? 'Mirror syncing'
        : mirrorState.status === 'synced'
          ? 'Mirror up to date'
          : mirrorState.status === 'failed'
            ? 'Mirror failed'
            : 'Mirror ready';
  const mirrorStatusClassName = [
    'stitch-icon-button',
    'mirror-status-button',
    mirrorStatusDisabled || !mirrorState.enabled ? 'mirror-disabled' : '',
    !mirrorStatusDisabled && mirrorState.status === 'syncing' ? 'mirror-syncing' : '',
    !mirrorStatusDisabled && mirrorState.status === 'synced' ? 'mirror-synced' : '',
    !mirrorStatusDisabled && mirrorState.status === 'failed' ? 'mirror-failed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const shareTitle = publicSharingAvailable ? 'Share' : publicSharingUnavailableReason;

  return (
    <header className="top-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-product-title font-orbitron">LocalStudio.dev</h1>
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
                  setPlayMenuOpen(false);
                  setOpenMenu((current) => (current === item ? null : item));
                }}
              >
                {item}
              </button>
              {openMenu === item ? (
                <div className="toolbar-dropdown" role="menu" aria-label={`${item} menu`}>
                  {menuActions[item].map((action) =>
                    action.kind === 'separator' ? (
                      <div
                        aria-label={action.label}
                        className="toolbar-dropdown-separator"
                        key={action.label}
                        role="separator"
                      />
                    ) : (
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
                    ),
                  )}
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
          <div className="project-play-shell">
            <button
              className="project-play-button project-play-main"
              type="button"
              aria-label="Play presentation"
              title="Play presentation"
              onClick={() => startPresenterMode()}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                play_arrow
              </span>
              <span>Play</span>
            </button>
            <button
              className="project-play-button project-play-menu-button"
              type="button"
              aria-expanded={playMenuOpen}
              aria-label="Presentation play options"
              title="Presentation play options"
              onClick={() => {
                setOpenMenu(null);
                setPlayMenuOpen((current) => !current);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                keyboard_arrow_down
              </span>
            </button>
            {playMenuOpen ? (
              <div
                className="toolbar-dropdown project-play-dropdown"
                role="menu"
                aria-label="Presentation play menu"
              >
                <button
                  className="toolbar-dropdown-item project-play-dropdown-item"
                  role="menuitem"
                  type="button"
                  onClick={() => startPresenterMode({ fromBeginning: true })}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    skip_previous
                  </span>
                  <span>Play from beginning</span>
                </button>
              </div>
            ) : null}
          </div>
          <span className="local-only-badge" title={mirrorState.error}>
            {mirrorLabel}
          </span>
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
                  : persistenceAttention
                    ? 'stitch-icon-button persistence-off persistence-attention'
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
          {persistenceNotice ? (
            <div className="persistence-notice" role="status">
              {persistenceNotice}
            </div>
          ) : null}
          {localProjectSetupPanel}
          <button
            className={mirrorStatusClassName}
            disabled={mirrorStatusDisabled}
            title={mirrorState.error ?? mirrorStatusLabel}
            type="button"
            aria-label={mirrorStatusLabel}
            onClick={() => {
              if (mirrorState.enabled) {
                onMirrorToggle?.(false);
                return;
              }
              onMirrorNow?.();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {mirrorState.status === 'syncing' ? 'sync' : 'cloud_sync'}
            </span>
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
        <button
          className="language-chip"
          type="button"
          aria-label={`Current slide language ${languageLabel}`}
        >
          <span className="language-flag" aria-hidden="true">
            {languageFlag}
          </span>
          <span>{language}</span>
        </button>
        <a
          className="github-toolbar-link"
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Star LocalStudio.dev on GitHub"
          title="Star LocalStudio.dev on GitHub"
        >
          <GitHubLogo />
          <span className="github-toolbar-count" aria-label={`${githubStarCount} GitHub stars`}>
            {stars}
          </span>
        </a>
        <button
          className="export-button font-orbitron"
          disabled={!publicSharingAvailable}
          title={shareTitle}
          type="button"
          onClick={triggerShare}
        >
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
