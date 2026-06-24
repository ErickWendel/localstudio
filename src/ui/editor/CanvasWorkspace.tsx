import { Layer, Rect, Stage, Text } from 'react-konva';
import type { DesignElement, ProjectDocument, SelectionState } from '../../domain/model';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
}

function isDesignElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element);
}

export function CanvasWorkspace({ project, activePageId, selection }: CanvasWorkspaceProps) {
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const visibleElements = page?.elementIds.map((id) => project.elements[id]).filter(isDesignElement) ?? [];
  const hasSelection = selection.elementIds.length > 0;
  const stageWidth = 768;
  const stageHeight = 432;
  const scale = page ? stageWidth / page.width : 1;

  return (
    <div className="canvas-workspace">
      <div className="canvas-frame neon-border" aria-label="Slide canvas">
        <div className="canvas-artboard" aria-hidden="true">
          <Stage height={stageHeight} width={stageWidth}>
            <Layer>
              {visibleElements.map((element) => {
                if (element.type === 'shape') {
                  return (
                    <Rect
                      key={element.id}
                      x={element.x * scale}
                      y={element.y * scale}
                      width={element.width * scale}
                      height={element.height * scale}
                      fill={element.fill}
                      opacity={element.opacity}
                    />
                  );
                }

                if (element.type === 'image') {
                  return (
                    <Rect
                      key={element.id}
                      x={element.x * scale}
                      y={element.y * scale}
                      width={element.width * scale}
                      height={element.height * scale}
                      fill="#101B1D"
                      stroke="#37FD76"
                      strokeWidth={1}
                      opacity={element.opacity}
                      cornerRadius={6}
                    />
                  );
                }

                return (
                  <Text
                    key={element.id}
                    x={element.x * scale}
                    y={element.y * scale}
                    width={element.width * scale}
                    height={element.height * scale}
                    text={element.text}
                    fontFamily={element.fontFamily}
                    fontSize={element.fontSize * scale}
                    fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
                    fill={element.fill}
                    align={element.align}
                    opacity={element.opacity}
                  />
                );
              })}
            </Layer>
          </Stage>
          <span className="canvas-fallback-label">Selected Image</span>
        </div>
        <div className="canvas-accessible-text">
          {visibleElements.map((element) =>
            element.type === 'text' ? <span key={element.id}>{element.text}</span> : null,
          )}
        </div>
        <span className="canvas-size">
          {page?.width} x {page?.height}
        </span>
        {hasSelection ? <FloatingSelectionToolbar /> : null}
      </div>
    </div>
  );
}
