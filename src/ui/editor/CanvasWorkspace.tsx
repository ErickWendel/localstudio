import type { ProjectDocument, SelectionState } from '../../domain/model';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
}

export function CanvasWorkspace({ project, activePageId, selection }: CanvasWorkspaceProps) {
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const titleElement = project.elements['text-title'];
  const subtitleElement = project.elements['text-subtitle'];
  const hasSelection = selection.elementIds.length > 0;

  return (
    <div className="canvas-workspace">
      <div className="canvas-frame neon-border" aria-label="Slide canvas">
        <div className="canvas-artboard">
          <div className="canvas-image-card">Selected Image</div>
          {titleElement?.type === 'text' ? (
            <h1 className="canvas-title font-orbitron">{titleElement.text}</h1>
          ) : null}
          {subtitleElement?.type === 'text' ? (
            <p className="canvas-subtitle">{subtitleElement.text}</p>
          ) : null}
        </div>
        <span className="canvas-size">
          {page?.width} x {page?.height}
        </span>
        {hasSelection ? <FloatingSelectionToolbar /> : null}
      </div>
    </div>
  );
}
