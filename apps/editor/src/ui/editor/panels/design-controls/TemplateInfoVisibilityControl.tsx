import type { ProjectDocument } from '../../../../domain/documents/model';
import { pptxTemplateInfo } from '../../../../domain/documents/pptxTemplateInfo';

interface TemplateInfoVisibilityControlProps {
  project: ProjectDocument;
  onSetVisibility: ((visible: boolean) => void) | undefined;
}

export function TemplateInfoVisibilityControl({
  project,
  onSetVisibility,
}: TemplateInfoVisibilityControlProps) {
  const hasTemplateInfo = pptxTemplateInfo.hasDeckElements(project);
  const templateInfoVisible = pptxTemplateInfo.isDeckVisible(project);

  return (
    <label className="template-checkbox-row">
      <input
        checked={templateInfoVisible}
        disabled={!hasTemplateInfo || !onSetVisibility}
        type="checkbox"
        onChange={(event) => {
          onSetVisibility?.(event.target.checked);
        }}
      />
      <span>Show template info across deck</span>
    </label>
  );
}
