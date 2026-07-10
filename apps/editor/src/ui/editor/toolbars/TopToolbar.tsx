import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProjectDocument } from '../../../domain/documents/model';
import type { MirrorState, PersistenceStorageMode } from '../../../services/contracts/interfaces';
import type { OperationNoticeState } from '../state/useEditorViewModel';
import type { TranslationLanguageOption } from '../translation/translationLanguages';
import { ProjectPlayControl } from './ProjectPlayControl';

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
  persistenceMode?: PersistenceStorageMode;
  lastEditedAt?: string | undefined;
  mirrorState?: MirrorState;
  mirrorDisabledBySettings?: boolean;
  localProjectSetupPanel?: ReactNode;
  persistenceAttention?: boolean;
  operationNotice?: OperationNoticeState | undefined;
  saveAnimationKey?: number;
  canTranslateDeck?: boolean;
  deckTranslationStatus?: string | undefined;
  isTranslatingDeck?: boolean;
  isExportingImages?: boolean;
  isExportingPowerPoint?: boolean;
  translationLanguageOptions?: TranslationLanguageOption[];
  translationSourceLanguage?: string;
  translationTargetLanguage?: string;
  onDelete?: (() => void) | undefined;
  onDuplicate?: (() => void) | undefined;
  onExportImages?: (() => void) | undefined;
  onExportPowerPoint?: (() => void) | undefined;
  onImportPowerPoint?: (() => void) | undefined;
  onImportProject?: (() => void) | undefined;
  onImportRemoteMirror?: (() => void) | undefined;
  onMirrorNow?: (() => void) | undefined;
  onMirrorToggle?: ((enabled: boolean) => void) | undefined;
  onOpenMirrorSettings?: (() => void) | undefined;
  onOpenKeyboardShortcuts?: (() => void) | undefined;
  onStartAiSetupTour?: (() => void) | undefined;
  onOpenVersionHistory?: (() => void) | undefined;
  onNewProject?: (() => void) | undefined;
  onPersistenceToggle?: ((enabled: boolean) => void) | undefined;
  onSaveLocal?: (() => void) | undefined;
  onSaveLocalAs?: (() => void) | undefined;
  onProjectNameChange?: ((name: string) => void) | undefined;
  onOpenPresenterView?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  onResetZoom?: (() => void) | undefined;
  onSelectLayers?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onStartPresenterMode?: ((options?: { fromBeginning?: boolean }) => void) | undefined;
  onTranslationSourceLanguageChange?: ((languageCode: string) => void) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
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

interface HeaderMenuSubmenu {
  kind: 'submenu';
  label: string;
  items: HeaderMenuActionItem[];
}

type HeaderMenuAction = HeaderMenuActionItem | HeaderMenuSeparator | HeaderMenuSubmenu;

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
  persistenceMode = persistenceAvailable ? 'directory' : 'none',
  lastEditedAt,
  mirrorState = { enabled: false, status: 'disabled' },
  mirrorDisabledBySettings = false,
  localProjectSetupPanel,
  persistenceAttention = false,
  operationNotice,
  saveAnimationKey = 0,
  canTranslateDeck = false,
  deckTranslationStatus,
  isTranslatingDeck = false,
  isExportingImages = false,
  isExportingPowerPoint = false,
  translationLanguageOptions = [],
  translationSourceLanguage = language.toLowerCase(),
  translationTargetLanguage = '',
  onDelete,
  onDuplicate,
  onExportImages,
  onExportPowerPoint,
  onImportPowerPoint,
  onImportProject,
  onImportRemoteMirror,
  onMirrorNow,
  onMirrorToggle,
  onOpenMirrorSettings,
  onOpenKeyboardShortcuts,
  onStartAiSetupTour,
  onOpenVersionHistory,
  onNewProject,
  onPersistenceToggle,
  onProjectNameChange,
  onOpenPresenterView,
  onRedo,
  onResetZoom,
  onSelectLayers,
  onShare,
  onStartPresenterMode,
  onSaveLocal,
  onSaveLocalAs,
  onTranslationSourceLanguageChange,
  onTranslationTargetLanguageChange,
  onTranslateDeck,
  onUndo,
  onZoomIn,
  onZoomOut,
}: TopToolbarProps) {
  const [openMenu, setOpenMenu] = useState<HeaderMenu | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [translationMenuOpen, setTranslationMenuOpen] = useState(false);
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(project.name);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const toolbarMenuRef = useRef<HTMLElement>(null);
  const translationMenuRef = useRef<HTMLDivElement>(null);
  const stars = useAnimatedStarCount(githubStarCount);

  useEffect(() => {
    if (!isEditingProjectName) return;

    projectNameInputRef.current?.focus();
    projectNameInputRef.current?.select();
  }, [isEditingProjectName]);

  useEffect(() => {
    if (!translationMenuOpen) return;

    const closeTranslationMenuOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (translationMenuRef.current?.contains(target)) return;

      setTranslationMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeTranslationMenuOnOutsidePointer);

    return () => {
      document.removeEventListener('pointerdown', closeTranslationMenuOnOutsidePointer);
    };
  }, [translationMenuOpen]);

  useEffect(() => {
    if (!openMenu) return;

    const closeHeaderMenuOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolbarMenuRef.current?.contains(target)) return;

      setOpenMenu(null);
    };

    document.addEventListener('pointerdown', closeHeaderMenuOnOutsidePointer);

    return () => {
      document.removeEventListener('pointerdown', closeHeaderMenuOnOutsidePointer);
    };
  }, [openMenu]);

  function triggerShare() {
    onShare?.();
  }

  function closeMenu() {
    setOpenMenu(null);
    setOpenSubmenu(null);
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
      {
        kind: 'submenu',
        label: 'Import',
        items: [
          { label: 'Project', disabled: !onImportProject, onSelect: onImportProject },
          {
            label: 'PowerPoint (.pptx)',
            disabled: !onImportPowerPoint,
            onSelect: onImportPowerPoint,
          },
          { label: 'Remote', disabled: !onImportRemoteMirror, onSelect: onImportRemoteMirror },
        ],
      },
      {
        kind: 'submenu',
        label: 'Export to',
        items: [
          {
            label: isExportingImages ? 'Exporting images...' : 'Images (.zip)',
            disabled: isExportingImages || !onExportImages,
            onSelect: onExportImages,
          },
          {
            label: isExportingPowerPoint ? 'Exporting PowerPoint...' : 'Powerpoint (.pptx)',
            disabled: isExportingPowerPoint || !onExportPowerPoint,
            onSelect: onExportPowerPoint,
          },
        ],
      },
      { label: 'Share', disabled: !onShare, onSelect: triggerShare },
      { kind: 'separator', label: 'File storage actions' },
      { label: 'Save', disabled: !onSaveLocal, onSelect: onSaveLocal },
      { label: 'Save As...', disabled: !onSaveLocalAs, onSelect: onSaveLocalAs },
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
      { label: 'AI Setup Tour', disabled: !onStartAiSetupTour, onSelect: onStartAiSetupTour },
      {
        label: 'Keyboard Shortcuts',
        disabled: !onOpenKeyboardShortcuts,
        onSelect: onOpenKeyboardShortcuts,
      },
      { label: 'Local AI Setup', disabled: true },
    ],
  };

  function handleMenuAction(action: HeaderMenuAction) {
    if (action.kind === 'separator') return;
    if (action.kind === 'submenu') {
      setOpenSubmenu((current) => (current === action.label ? null : action.label));
      return;
    }
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
    : persistenceMode === 'opfs'
      ? persistenceEnabled
        ? 'Browser storage enabled'
        : 'Browser storage disabled'
      : persistenceEnabled
        ? 'Persistence enabled'
        : 'Persistence disabled';
  const persistenceTitle = !persistenceAvailable
    ? 'Local project persistence is not available in this browser.'
    : persistenceMode === 'opfs'
      ? persistenceEnabled
        ? 'Browser-private project storage is enabled. Files are stored by this browser profile and are not visible in Finder.'
        : 'Save this deck in browser-private storage. Files are scoped to this browser profile and are not visible in Finder.'
      : persistenceEnabled
        ? 'Local folder persistence is enabled'
        : 'Save this deck to a local folder';
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
  const shareTitle = 'Share';
  const deckTranslateButtonClassName = [
    'stitch-icon-button',
    'deck-translate-button',
    isTranslatingDeck ? 'deck-translate-button-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className="top-toolbar" data-tour-id="top-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-product-title font-orbitron">LocalStudio.dev</h1>
        <nav className="toolbar-menu" aria-label="Application menu" ref={toolbarMenuRef}>
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
                data-tour-id={`${item.toLowerCase()}-menu-button`}
                onClick={() => {
                  setTranslationMenuOpen(false);
                  setPlayMenuOpen(false);
                  setOpenSubmenu(null);
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
                    ) : action.kind === 'submenu' ? (
                      <div className="toolbar-dropdown-submenu" key={action.label}>
                        <button
                          aria-expanded={openSubmenu === action.label}
                          className="toolbar-dropdown-item toolbar-dropdown-submenu-trigger"
                          data-tour-id={
                            action.label === 'Import' ? 'file-import-menu-item' : undefined
                          }
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            handleMenuAction(action);
                          }}
                        >
                          <span>{action.label}</span>
                          <span aria-hidden="true">›</span>
                        </button>
                        {openSubmenu === action.label ? (
                          <div
                            className="toolbar-dropdown toolbar-dropdown-nested"
                            role="menu"
                            aria-label={action.label}
                          >
                            {action.items.map((item) => (
                              <button
                                className="toolbar-dropdown-item"
                                data-tour-id={
                                  item.label === 'PowerPoint (.pptx)'
                                    ? 'file-import-pptx-item'
                                    : undefined
                                }
                                disabled={item.disabled}
                                key={item.label}
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  handleMenuAction(item);
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
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
              data-tour-id="project-name"
              onClick={() => {
                setProjectNameDraft(project.name);
                setIsEditingProjectName(true);
              }}
            >
              {project.name}
            </button>
          )}
          <ProjectPlayControl
            isMenuOpen={playMenuOpen}
            onMenuOpenChange={(isOpen) => {
              setOpenMenu(null);
              setTranslationMenuOpen(false);
              setPlayMenuOpen(isOpen);
            }}
            onOpenPresenterView={onOpenPresenterView}
            onStartPresenterMode={onStartPresenterMode}
          />
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
            data-tour-id="storage-toggle"
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
          {operationNotice ? (
            <div
              className={`operation-notice operation-notice-${operationNotice.tone}`}
              role="status"
            >
              <span className="operation-notice-message">{operationNotice.message}</span>
              {operationNotice.detail ? (
                <span className="operation-notice-detail">{operationNotice.detail}</span>
              ) : null}
              {operationNotice.progress ? (
                <span
                  className="operation-notice-progress"
                  aria-label={`${operationNotice.progress.current} of ${operationNotice.progress.total}`}
                >
                  <span
                    className="operation-notice-progress-fill"
                    style={{
                      width: `${Math.round(
                        (operationNotice.progress.current / operationNotice.progress.total) * 100,
                      )}%`,
                    }}
                  />
                </span>
              ) : null}
            </div>
          ) : null}
          {localProjectSetupPanel}
          <button
            className={mirrorStatusClassName}
            disabled={mirrorStatusDisabled}
            title={mirrorState.error ?? mirrorStatusLabel}
            type="button"
            aria-label={mirrorStatusLabel}
            data-tour-id="mirror-status"
            onClick={() => {
              if (mirrorDisabledBySettings) {
                onOpenMirrorSettings?.();
                return;
              }
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
            data-tour-id="version-history"
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
          <div className="deck-translation-shell" ref={translationMenuRef}>
            <button
              className={`${deckTranslateButtonClassName} deck-translation-main`}
              disabled={!canTranslateDeck || !onTranslateDeck}
              title={deckTranslationStatus ?? 'Translate deck using the selected target language'}
              type="button"
              aria-label="Translate deck"
              data-tour-id="translate-deck"
              onClick={onTranslateDeck}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                translate
              </span>
            </button>
            <button
              className="stitch-icon-button deck-translation-menu-button"
              type="button"
              aria-expanded={translationMenuOpen}
              aria-label="Translation path options"
              title="Translation path options"
              onClick={() => {
                setOpenMenu(null);
                setPlayMenuOpen(false);
                setTranslationMenuOpen((current) => !current);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                keyboard_arrow_down
              </span>
            </button>
            {translationMenuOpen ? (
              <div className="translation-path-dropdown" role="group" aria-label="Translation path">
                <label className="translation-path-field ew-field-scope">
                  <span>From</span>
                  <select
                    value={translationSourceLanguage}
                    aria-label="Translate from"
                    onChange={(event) => onTranslationSourceLanguageChange?.(event.target.value)}
                  >
                    {translationLanguageOptions.map((option) => (
                      <option value={option.code} key={option.code}>
                        {option.label} ({option.code}) {option.flag}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="translation-path-field ew-field-scope">
                  <span>To</span>
                  <select
                    value={translationTargetLanguage}
                    aria-label="Translate to"
                    onChange={(event) => onTranslationTargetLanguageChange?.(event.target.value)}
                  >
                    <option value="">Choose language</option>
                    {translationLanguageOptions.map((option) => (
                      <option value={option.code} key={option.code}>
                        {option.label} ({option.code}) {option.flag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
          {deckTranslationStatus ? (
            <div className="deck-translation-status" role="status" aria-live="polite">
              <span className="deck-translation-status-orbit" aria-hidden="true" />
              <span className="ew-truncate">{deckTranslationStatus}</span>
            </div>
          ) : null}
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
          disabled={!onShare}
          title={shareTitle}
          type="button"
          data-tour-id="share-button"
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
