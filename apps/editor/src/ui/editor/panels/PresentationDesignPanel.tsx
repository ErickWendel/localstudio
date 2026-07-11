import { ChevronDown } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { PresentationTheme, ProjectDocument } from '../../../domain/documents/model';
import { PanelSection } from '../../components/PanelSection';

const defaultPresentationTheme: PresentationTheme = {
  id: 'theme-default',
  name: 'Default theme',
  palette: {
    accent: '#37FD76',
    background: '#050D10',
    mutedText: '#91999D',
    surface: '#0C1417',
    text: '#FFFFFF',
  },
  typography: {
    bodyFontFamily: 'Open Sans',
    headingFontFamily: 'Orbitron',
  },
};

function getThemeOptions(project: ProjectDocument) {
  const importedThemes = Object.values(project.themes ?? {}).filter(
    (theme) => theme.id !== defaultPresentationTheme.id && theme.palette && theme.typography,
  );
  return [defaultPresentationTheme, ...importedThemes];
}

function ThemeChooser({
  activeThemeId,
  themes,
  onApplyTheme,
}: {
  activeThemeId: string;
  themes: PresentationTheme[];
  onApplyTheme: (themeId: string) => void;
}) {
  return (
    <div className="template-chooser-shelf" aria-label="Choose a theme" role="region">
      <div className="template-chooser-title">Choose a theme</div>
      <div className="theme-choice-list">
        {themes.map((theme) => (
          <button
            aria-current={theme.id === activeThemeId ? 'true' : undefined}
            className={
              theme.id === activeThemeId
                ? 'theme-choice-card theme-choice-card-active'
                : 'theme-choice-card'
            }
            key={theme.id}
            type="button"
            onClick={() => onApplyTheme(theme.id)}
          >
            <span
              className="theme-choice-preview"
              style={
                {
                  '--theme-choice-accent': theme.palette.accent,
                  '--theme-choice-background': theme.palette.background,
                  '--theme-choice-surface': theme.palette.surface,
                  '--theme-choice-text': theme.palette.text,
                } as CSSProperties
              }
            >
              <span />
              <span />
              <span />
            </span>
            <span className="theme-choice-copy">
              <strong>{theme.name}</strong>
              <span>
                {theme.typography.headingFontFamily} / {theme.typography.bodyFontFamily}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PresentationDesignPanel({
  page,
  project,
  onApplyTheme,
  onChangeTheme,
  onEditTheme,
}: {
  page?: ProjectDocument['pages'][number] | undefined;
  project: ProjectDocument;
  onApplyTheme: ((themeId: string) => void) | undefined;
  onChangeTheme: (() => void) | undefined;
  onEditTheme: ((themeId: string) => void) | undefined;
}) {
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themeOptions = getThemeOptions(project);
  const theme =
    themeOptions.find((item) => item.id === project.themeId) ??
    (project.themeId ? project.themes?.[project.themeId] : undefined) ??
    defaultPresentationTheme;
  const themeId = theme.id;
  const themeName = theme?.name ?? 'Custom theme';

  return (
    <div className="panel-stack">
      <PanelSection title="Presentation">
        <button
          aria-expanded={themePickerOpen}
          aria-label={`Open theme picker, current theme ${themeName}`}
          className="template-preview-card template-preview-button"
          type="button"
          onClick={() => setThemePickerOpen((current) => !current)}
        >
          <div className="template-filmstrip" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="template-preview-copy">
            <span>Theme</span>
            <strong>{themeName}</strong>
          </div>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {themePickerOpen ? (
          <ThemeChooser
            activeThemeId={themeId}
            themes={themeOptions}
            onApplyTheme={(nextThemeId) => {
              onApplyTheme?.(nextThemeId);
              setThemePickerOpen(false);
            }}
          />
        ) : null}
        <div className="template-action-row">
          <button type="button" onClick={onChangeTheme}>
            Change theme
          </button>
          <button
            type="button"
            disabled={!themeId}
            onClick={() => themeId && onEditTheme?.(themeId)}
          >
            Edit theme
          </button>
          <button
            type="button"
            disabled={!themeId}
            onClick={() => themeId && onApplyTheme?.(themeId)}
          >
            Apply theme
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Slideshow Settings">
        <label className="template-checkbox-row">
          <input type="checkbox" />
          <span>Automatically play upon open</span>
        </label>
        <label className="template-checkbox-row">
          <input type="checkbox" />
          <span>Loop slideshow</span>
        </label>
        <label className="template-checkbox-row">
          <input type="checkbox" />
          <span>Restart show if idle for</span>
        </label>
      </PanelSection>

      <PanelSection title="Presentation Type">
        <label className="design-control ew-field-scope">
          <span>Type</span>
          <select aria-label="Presentation type" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="kiosk">Kiosk</option>
            <option value="self-running">Self-running</option>
          </select>
        </label>
        <div className="property-row ew-surface ew-surface-hover ew-compact-row">
          <span>Slide size</span>
          <strong>{page ? `${page.width} x ${page.height}` : 'No slide'}</strong>
        </div>
      </PanelSection>
    </div>
  );
}
