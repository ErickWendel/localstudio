import { localStudioAppRoutes } from '@localstudio/app-routes';
import { localStudioLogoMark } from '@localstudio/brand/logo';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProjectDocument } from '../../../domain/documents/model';
import type { MirrorState, PersistenceStorageMode } from '../../../services/contracts/interfaces';
import type { OperationNoticeState } from '../state/useEditorViewModel';
import type { TranslationLanguageOption } from '../translation/translationLanguages';
import { DeckTranslationControl } from './DeckTranslationControl';
import { GitHubToolbarLink } from './GitHubToolbarLink';
import { ProjectPlayControl } from './ProjectPlayControl';
import { ToolbarMirrorButton } from './ToolbarMirrorButton';
import { ToolbarOperationNotice } from './ToolbarOperationNotice';
import { ToolbarPersistenceButton } from './ToolbarPersistenceButton';

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
const githubIssuesUrl = 'https://github.com/ErickWendel/localstudio/issues/new/choose';
const docsUrl = localStudioAppRoutes.docs.gettingStartedAnchor;

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
    setOpenMenu(null);
    setOpenSubmenu(null);
    setPlayMenuOpen(false);
    setTranslationMenuOpen(false);
    onShare?.();
  }

  function closeMenu() {
    setOpenMenu(null);
    setOpenSubmenu(null);
  }

  function switchOpenHeaderMenu(menu: HeaderMenu) {
    if (!openMenu || openMenu === menu) return;
    setTranslationMenuOpen(false);
    setPlayMenuOpen(false);
    setOpenSubmenu(null);
    setOpenMenu(menu);
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
    ],
    View: [
      {
        kind: 'submenu',
        label: 'Zoom',
        items: [
          { label: 'Zoom Out', disabled: !onZoomOut, onSelect: onZoomOut },
          { label: '100%', disabled: !onResetZoom, onSelect: onResetZoom },
          { label: 'Zoom In', disabled: !onZoomIn, onSelect: onZoomIn },
        ],
      },
    ],
    Help: [
      {
        label: 'Docs',
        onSelect: () => {
          window.open(docsUrl, '_blank', 'noopener,noreferrer');
        },
      },
      { label: 'AI Setup Tour', disabled: !onStartAiSetupTour, onSelect: onStartAiSetupTour },
      {
        label: 'Keyboard Shortcuts',
        disabled: !onOpenKeyboardShortcuts,
        onSelect: onOpenKeyboardShortcuts,
      },
      {
        label: 'Found a bug?',
        onSelect: () => {
          window.open(githubIssuesUrl, '_blank', 'noopener,noreferrer');
        },
      },
    ],
  };

  function handleMenuAction(action: HeaderMenuAction) {
    if (action.kind === 'separator') return;
    if (action.kind === 'submenu') {
      setOpenSubmenu(action.label);
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
  const shareTitle = 'Share';
  return (
    <header className="top-toolbar" data-tour-id="top-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-product-title" aria-label="LocalStudio.dev">
          <svg
            aria-hidden="true"
            className="ls-logo-mark toolbar-product-logo"
            focusable="false"
            viewBox={localStudioLogoMark.viewBox}
          >
            <path
              className="ls-logo-mark__layer ls-logo-mark__layer-back"
              d={localStudioLogoMark.backLayerPath}
            />
            <path
              className="ls-logo-mark__layer ls-logo-mark__layer-middle"
              d={localStudioLogoMark.middleLayerPath}
            />
            <path
              className="ls-logo-mark__layer ls-logo-mark__layer-front"
              d={localStudioLogoMark.frontLayerPath}
            />
            <circle className="ls-logo-mark__dot" cx="31" cy="26" r="1.5" />
            <circle className="ls-logo-mark__dot" cx="36" cy="26" r="1.5" />
            <circle className="ls-logo-mark__dot" cx="41" cy="26" r="1.5" />
            <path className="ls-logo-mark__bar" d={localStudioLogoMark.browserBarPath} />
          </svg>
          <span className="ls-logo-word">LocalStudio</span>
        </h1>
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
                  setOpenMenu(item);
                }}
                onPointerEnter={() => {
                  switchOpenHeaderMenu(item);
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
                        onPointerEnter={() => {
                          setOpenSubmenu(null);
                        }}
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
                          onPointerEnter={() => {
                            setOpenSubmenu(action.label);
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
                        onPointerEnter={() => {
                          setOpenSubmenu(null);
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
              <span className="project-title-text">{project.name}</span>
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
          <ToolbarPersistenceButton
            persistenceAttention={persistenceAttention}
            persistenceAvailable={persistenceAvailable}
            persistenceEnabled={persistenceEnabled}
            persistenceMode={persistenceMode}
            onPersistenceToggle={onPersistenceToggle}
          />
          {operationNotice ? <ToolbarOperationNotice operationNotice={operationNotice} /> : null}
          {localProjectSetupPanel}
          <ToolbarMirrorButton
            mirrorDisabledBySettings={mirrorDisabledBySettings}
            mirrorState={mirrorState}
            persistenceEnabled={persistenceEnabled}
            onMirrorNow={onMirrorNow}
            onMirrorToggle={onMirrorToggle}
            onOpenMirrorSettings={onOpenMirrorSettings}
          />
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
          <DeckTranslationControl
            canTranslateDeck={canTranslateDeck}
            deckTranslationStatus={deckTranslationStatus}
            isMenuOpen={translationMenuOpen}
            isTranslatingDeck={isTranslatingDeck}
            menuRef={translationMenuRef}
            translationLanguageOptions={translationLanguageOptions}
            translationSourceLanguage={translationSourceLanguage}
            translationTargetLanguage={translationTargetLanguage}
            onMenuOpenChange={(isOpen) => {
              setOpenMenu(null);
              setPlayMenuOpen(false);
              setTranslationMenuOpen(isOpen);
            }}
            onTranslationSourceLanguageChange={onTranslationSourceLanguageChange}
            onTranslationTargetLanguageChange={onTranslationTargetLanguageChange}
            onTranslateDeck={onTranslateDeck}
          />
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
        <GitHubToolbarLink />
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
