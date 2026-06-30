import type { DragEvent } from 'react';
import type {
  ElementAnimationBuild,
  ElementAnimationBuild as ElementAnimationPatchSource,
  ProjectDocument,
  SelectionState,
  SlideTransition,
} from '../../domain/model';

type ElementAnimationPatch = Omit<ElementAnimationPatchSource, 'elementId' | 'id'>;

interface AnimationPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onClearElementAnimationBuild?: ((elementId: string) => void) | undefined;
  onClearPageTransition?: (() => void) | undefined;
  onPlayAnimationPreview?: (() => void) | undefined;
  onReorderElementAnimationBuild?: ((elementId: string, targetIndex: number) => void) | undefined;
  onSetElementAnimationBuilds?: ((elementIds: string[], patch: ElementAnimationPatch) => void) | undefined;
  onSetPageTransition?: ((transition: SlideTransition) => void) | undefined;
}

const DEFAULT_ELEMENT_ANIMATION: ElementAnimationPatch = {
  effect: 'reveal',
  trigger: 'on-click',
  delayMs: 0,
};

const DEFAULT_SLIDE_TRANSITION: SlideTransition = {
  effect: 'reveal',
  delayMs: 0,
};

const ANIMATION_BUILD_DRAG_TYPE = 'application/x-localstudio-animation-build-element-id';

function getElementLabel(project: ProjectDocument, elementId: string) {
  const element = project.elements[elementId];
  if (!element) return elementId;
  if (element.type === 'text') return element.text.trim().split('\n')[0] || 'Text';
  if (element.type === 'image') return 'Image';
  return element.shape === 'ellipse' ? 'Ellipse' : 'Rectangle';
}

function getBuildPatch(build: ElementAnimationBuild | undefined): ElementAnimationPatch {
  return build
    ? { effect: build.effect, trigger: build.trigger, delayMs: build.delayMs }
    : DEFAULT_ELEMENT_ANIMATION;
}

export function AnimationPanel({
  project,
  activePageId,
  selection,
  onClearElementAnimationBuild,
  onClearPageTransition,
  onPlayAnimationPreview,
  onReorderElementAnimationBuild,
  onSetElementAnimationBuilds,
  onSetPageTransition,
}: AnimationPanelProps) {
  const page = project.pages.find((item) => item.id === activePageId);
  const selectedElementIds = selection.elementIds.filter((elementId) => page?.elementIds.includes(elementId));
  const animationBuilds = (page?.animationBuilds ?? []).filter((build) => page?.elementIds.includes(build.elementId));
  const transition = page?.transition;

  function handleBuildDragStart(event: DragEvent<HTMLDivElement>, elementId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(ANIMATION_BUILD_DRAG_TYPE, elementId);
    event.dataTransfer.setData('text/plain', elementId);
  }

  function handleBuildDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleBuildDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();
    const draggedElementId =
      event.dataTransfer.getData(ANIMATION_BUILD_DRAG_TYPE) || event.dataTransfer.getData('text/plain');
    const draggedIndex = animationBuilds.findIndex((build) => build.elementId === draggedElementId);
    if (draggedIndex === -1 || draggedIndex === targetIndex) return;
    onReorderElementAnimationBuild?.(draggedElementId, targetIndex);
  }

  return (
    <section className="panel-stack animation-panel">
      <div className="panel-section">
        <div className="animation-panel-heading">
          <h2 className="panel-heading">Motion</h2>
          <button
            aria-label="Play animation preview"
            className="compact-action"
            type="button"
            onClick={onPlayAnimationPreview}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              play_arrow
            </span>
            Play
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h3 className="panel-section-title">Slide Transition</h3>
        <label className="animation-field">
          <span>Effect</span>
          <select
            aria-label="Slide transition effect"
            value={transition?.effect ?? 'none'}
            onChange={(event) => {
              if (event.target.value === 'none') {
                onClearPageTransition?.();
                return;
              }
              onSetPageTransition?.(DEFAULT_SLIDE_TRANSITION);
            }}
          >
            <option value="none">None</option>
            <option value="reveal">Reveal</option>
          </select>
        </label>
        <label className="animation-field">
          <span>Delay</span>
          <input
            aria-label="Slide transition delay"
            disabled={!transition}
            min={0}
            step={0.1}
            type="number"
            value={(transition?.delayMs ?? 0) / 1000}
            onChange={(event) => {
              onSetPageTransition?.({
                effect: 'reveal',
                delayMs: Math.max(0, Number(event.target.value) * 1000 || 0),
              });
            }}
          />
        </label>
      </div>

      <div className="panel-section">
        <h3 className="panel-section-title">Object Animations</h3>
        <div className="animation-build-list" role="list" aria-label="Object animation build order">
          {animationBuilds.length === 0 ? (
            <p className="panel-muted">No object animations on this slide.</p>
          ) : null}
          {animationBuilds.map((build, index) => {
            const elementId = build.elementId;
            const label = getElementLabel(project, elementId);
            const patch = getBuildPatch(build);
            return (
              <div
                aria-label={`Build ${index + 1}: ${label}`}
                className="animation-build-row"
                draggable
                key={build.id}
                role="listitem"
                onDragOver={handleBuildDragOver}
                onDragStart={(event) => handleBuildDragStart(event, elementId)}
                onDrop={(event) => handleBuildDrop(event, index)}
              >
                <div className="animation-build-title">
                  <span className="animation-build-name">
                    <span className="material-symbols-outlined animation-build-drag-handle" aria-hidden="true">
                      drag_indicator
                    </span>
                    <span className="animation-build-number" aria-label={`Build ${index + 1}`}>
                      {index + 1}
                    </span>
                    <span>{label}</span>
                  </span>
                  <div className="animation-build-actions">
                    <button
                      aria-label={`Move ${label} animation up`}
                      className="icon-button"
                      disabled={index === 0}
                      type="button"
                      onClick={() => onReorderElementAnimationBuild?.(elementId, index - 1)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        keyboard_arrow_up
                      </span>
                    </button>
                    <button
                      aria-label={`Move ${label} animation down`}
                      className="icon-button"
                      disabled={index === animationBuilds.length - 1}
                      type="button"
                      onClick={() => onReorderElementAnimationBuild?.(elementId, index + 1)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        keyboard_arrow_down
                      </span>
                    </button>
                    <button
                      aria-label={`Remove animation from ${label}`}
                      className="icon-button"
                      type="button"
                      onClick={() => onClearElementAnimationBuild?.(elementId)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
                <label className="animation-field">
                  <span>Effect</span>
                  <select
                    aria-label={`Effect for ${label}`}
                    value={build ? patch.effect : 'none'}
                    onChange={(event) => {
                      if (event.target.value === 'none') {
                        onClearElementAnimationBuild?.(elementId);
                        return;
                      }
                      onSetElementAnimationBuilds?.([elementId], { ...patch, effect: 'reveal' });
                    }}
                  >
                    <option value="none">None</option>
                    <option value="reveal">Reveal</option>
                  </select>
                </label>
                <label className="animation-field">
                  <span>Start</span>
                  <select
                    aria-label={`Start for ${label}`}
                    value={patch.trigger}
                    onChange={(event) => {
                      const trigger =
                        event.target.value === 'after-transition'
                          ? 'after-transition'
                          : event.target.value === 'after-previous'
                            ? 'after-previous'
                            : 'on-click';
                      onSetElementAnimationBuilds?.([elementId], {
                        ...patch,
                        trigger,
                      });
                    }}
                  >
                    <option value="on-click">On click</option>
                    <option value="after-transition">After transition</option>
                    <option value="after-previous">After previous build</option>
                  </select>
                </label>
                <label className="animation-field">
                  <span>Delay</span>
                  <input
                    aria-label={`Delay for ${label}`}
                    min={0}
                    step={0.1}
                    type="number"
                    value={patch.delayMs / 1000}
                    onChange={(event) => {
                      onSetElementAnimationBuilds?.([elementId], {
                        ...patch,
                        delayMs: Math.max(0, Number(event.target.value) * 1000 || 0),
                      });
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
        <button
          className="compact-action compact-action-full"
          disabled={selectedElementIds.length === 0}
          type="button"
          onClick={() => onSetElementAnimationBuilds?.(selectedElementIds, DEFAULT_ELEMENT_ANIMATION)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
          Add animation
        </button>
      </div>
    </section>
  );
}
