import type {
  AnimationEffect,
  AnimationTrigger,
  ElementAnimationBuild,
  ElementAnimationKind,
} from '../../../domain/documents/model';
import type { PptxSlideObject } from './pptx-parser-model';
import { pptxXml } from './pptxXml';

function getTransitionEffect(document: Document): AnimationEffect {
  const transition = pptxXml.firstDescendant(document, 'transition');
  if (!transition) return 'dissolve';
  if (pptxXml.firstDescendant(transition, 'fade')) return 'fade';
  if (pptxXml.firstDescendant(transition, 'push')) return 'push';
  if (pptxXml.firstDescendant(transition, 'wipe')) return 'wipe';
  return 'dissolve';
}

function toBuildKind(value: string | null): ElementAnimationKind {
  if (value === 'exit') return 'build-out';
  if (value === 'emph') return 'emphasis';
  return 'build-in';
}

function toBuildTrigger(value: string | null, index: number): AnimationTrigger {
  if (value === 'clickEffect') return 'on-click';
  if (value === 'afterEffect') return index === 0 ? 'after-transition' : 'after-previous';
  return index === 0 ? 'after-transition' : 'on-click';
}

function toMilliseconds(value: string | null, fallback: number) {
  if (!value || value === 'indefinite') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

function findBuildSourceShapeId(behavior: Element) {
  return pptxXml.firstDescendant(behavior, 'spTgt')?.getAttribute('spid');
}

function findNearestAnimationTimingNode(behavior: Element) {
  let current: Element | null = behavior;
  while (current) {
    if (current.localName === 'cTn' && current.hasAttribute('nodeType')) return current;
    current = current.parentElement;
  }
  return undefined;
}

function getBuildDurationMs(timingNode: Element | undefined) {
  const childDuration = timingNode
    ? pptxXml.descendants(timingNode, 'cTn').find((item) => item.hasAttribute('dur'))?.getAttribute('dur')
    : undefined;
  return toMilliseconds(childDuration ?? timingNode?.getAttribute('dur') ?? null, 500);
}

function isMediaControlTiming(timingNode: Element | undefined) {
  return timingNode?.getAttribute('presetClass') === 'mediacall';
}

function toBuildEffect(timingNode: Element | undefined): AnimationEffect {
  if (!timingNode || isMediaControlTiming(timingNode)) return 'reveal';
  const presetSubtype = timingNode.getAttribute('presetSubtype');
  const presetId = timingNode.getAttribute('presetID');
  const effectFilter = pptxXml.firstDescendant(timingNode, 'animEffect')?.getAttribute('filter');
  const effectName = effectFilter ?? presetSubtype;
  if (effectName === 'fade' || effectName === 'dissolve' || presetId === '9' || presetId === '10') {
    return 'dissolve';
  }
  if (effectName === 'push') return 'push';
  if (effectName === 'wipe') return 'wipe';
  return 'reveal';
}

function getVideoStartTriggers(document: Document, objects: PptxSlideObject[]) {
  const videoObjectsByShapeId = new Map(
    objects
      .filter((object) => object.kind === 'video' && object.id.includes('-slide-'))
      .map((object) => [object.sourceShapeId, object]),
  );
  const triggers = new Map<string, AnimationTrigger>();
  let mediaBuildIndex = 0;
  pptxXml.descendants(document, 'cBhvr').forEach((behavior) => {
    const sourceShapeId = findBuildSourceShapeId(behavior);
    if (!sourceShapeId || !videoObjectsByShapeId.has(sourceShapeId)) return;
    const timingNode = findNearestAnimationTimingNode(behavior);
    if (!isMediaControlTiming(timingNode)) return;
    triggers.set(
      sourceShapeId,
      toBuildTrigger(timingNode?.getAttribute('nodeType') ?? null, mediaBuildIndex),
    );
    mediaBuildIndex += 1;
  });
  return triggers;
}

function parse(document: Document, slideId: string, objects: PptxSlideObject[]): ElementAnimationBuild[] {
  const slideObjectsByShapeId = new Map(
    objects
      .filter((object) => object.id.includes('-slide-'))
      .map((object) => [object.sourceShapeId, object]),
  );
  const builds: ElementAnimationBuild[] = [];
  const seenShapeIds = new Set<string>();
  pptxXml.descendants(document, 'cBhvr').forEach((behavior) => {
    const sourceShapeId = findBuildSourceShapeId(behavior);
    if (!sourceShapeId) return;
    if (seenShapeIds.has(sourceShapeId)) return;
    const object = slideObjectsByShapeId.get(sourceShapeId);
    if (!object) return;
    const timingNode = findNearestAnimationTimingNode(behavior);
    if (isMediaControlTiming(timingNode) && object.kind !== 'video') return;
    const buildIndex = builds.length;
    builds.push({
      id: `${slideId}-build-${buildIndex + 1}-${object.id}`,
      elementId: object.id,
      effect: toBuildEffect(timingNode),
      trigger: toBuildTrigger(timingNode?.getAttribute('nodeType') ?? null, buildIndex),
      delayMs: 0,
      durationMs: isMediaControlTiming(timingNode) ? 0 : getBuildDurationMs(timingNode),
      kind: toBuildKind(timingNode?.getAttribute('presetClass') ?? null),
      ...(isMediaControlTiming(timingNode) ? { mediaAction: 'play' as const } : {}),
    });
    seenShapeIds.add(sourceShapeId);
  });
  pptxXml.descendants(document, 'bldP').forEach((build) => {
    const sourceShapeId = build.getAttribute('spid');
    if (!sourceShapeId || seenShapeIds.has(sourceShapeId)) return;
    const object = slideObjectsByShapeId.get(sourceShapeId);
    if (!object) return;
    const buildIndex = builds.length;
    builds.push({
      id: `${slideId}-build-${buildIndex + 1}-${object.id}`,
      elementId: object.id,
      effect: 'reveal',
      trigger: toBuildTrigger(null, buildIndex),
      delayMs: 0,
      durationMs: 500,
      kind: 'build-in',
    });
    seenShapeIds.add(sourceShapeId);
  });
  return builds;
}

export const pptxAnimationBuilds = {
  getTransitionEffect,
  getVideoStartTriggers,
  parse,
};
