import type { ProjectDocument } from '../../domain/model';

interface TopToolbarProps {
  project: ProjectDocument;
  language: string;
}

export function TopToolbar({ project, language }: TopToolbarProps) {
  function handleExportClick() {
    window.alert(`Export PNG/PDF wiring ready for ${project.name}`);
  }

  return (
    <header className="top-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-product-title font-orbitron">EW Canvas AI</h1>
        <nav className="toolbar-menu" aria-label="Application menu">
          {['File', 'Edit', 'View', 'Help'].map((item) => (
            <button className="toolbar-menu-item font-orbitron" key={item} type="button">
              {item}
            </button>
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
          <button className="stitch-icon-button" title="Undo" type="button" aria-label="Undo">
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button className="stitch-icon-button" title="Redo" type="button" aria-label="Redo">
            <span className="material-symbols-outlined">redo</span>
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="zoom-group" aria-label="Zoom controls">
          <button className="stitch-icon-button" title="Zoom Out" type="button" aria-label="Zoom Out">
            <span className="material-symbols-outlined">remove</span>
          </button>
          <span className="zoom-value">100%</span>
          <button className="stitch-icon-button" title="Zoom In" type="button" aria-label="Zoom In">
            <span className="material-symbols-outlined">zoom_in</span>
          </button>
        </div>
        <button className="language-chip" type="button" aria-label={`Current language ${language}`}>
          <span className="language-flag" aria-hidden="true">
            🇧🇷
          </span>
          <span>{language}</span>
        </button>
        <button className="export-button font-orbitron" type="button" onClick={handleExportClick}>
          <span className="material-symbols-outlined">ios_share</span>
          <span>Export</span>
        </button>
        <button className="profile-avatar" type="button" aria-label="User profile">
          <span className="profile-avatar-core" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
