import { Download, Languages, Redo2, Undo2, UserRound, ZoomIn } from 'lucide-react';
import type { ProjectDocument } from '../../domain/model';
import { IconButton } from '../components/IconButton';

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
      <div className="brand-lockup" aria-label="EW Canvas AI">
        <span className="brand-mark">EW</span>
        <span className="brand-title font-orbitron">EW Canvas AI</span>
      </div>
      <div className="toolbar-divider" />
      <span className="project-title" title={project.name}>
        {project.name}
      </span>
      <div className="toolbar-actions" aria-label="Editing actions">
        <IconButton label="Undo">
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo">
          <Redo2 size={16} />
        </IconButton>
        <button className="zoom-control" type="button">
          <ZoomIn size={15} />
          100%
        </button>
      </div>
      <div className="toolbar-spacer" />
      <button className="language-chip" type="button" aria-label={`Current language ${language}`}>
        <span aria-hidden="true">BR</span>
        <span>{language}</span>
        <Languages size={14} />
      </button>
      <IconButton label="User profile">
        <UserRound size={16} />
      </IconButton>
      <button className="export-button font-orbitron" type="button" onClick={handleExportClick}>
        <Download size={15} />
        Export
      </button>
    </header>
  );
}
