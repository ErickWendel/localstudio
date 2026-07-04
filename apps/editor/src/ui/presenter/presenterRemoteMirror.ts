import type { DesignElement, Page, ProjectDocument } from '../../domain/documents/model';
import type { AnimationPreviewState } from '../editor/animation/useAnimationPreviewController';

export interface PresenterRemoteMirrorFrame {
  activePage: Page;
  activePageIndex: number;
  animationPreview: AnimationPreviewState | undefined;
  buildsRemaining: number;
  currentTimeLabel: string;
  notes: string;
  project: ProjectDocument;
  timerLabel: string;
  videoElements: HTMLVideoElement[];
}

const mirrorSize = { height: 844, width: 390 };
const mirrorBackground = '#020805';
const mirrorPanel = '#07120d';
const mirrorGreen = '#37fd76';
const mirrorCyan = '#36d7ff';
const mirrorText = '#f4f7f1';
const mirrorMuted = '#aab4a8';
const mirrorNotes = '#f3f5ee';
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string | undefined) {
  if (!src) return undefined;
  const cached = imageCache.get(src);
  if (cached) return cached.complete ? cached : undefined;
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  imageCache.set(src, image);
  return undefined;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let currentY = y;
  let lines = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width <= maxWidth) {
      line = testLine;
      continue;
    }
    if (line) {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
      lines += 1;
    }
    line = word;
    if (lines >= maxLines - 1) break;
  }
  if (line && lines < maxLines) context.fillText(line, x, currentY);
}

function getVideoElement(videoElements: HTMLVideoElement[], elementId: string) {
  return videoElements.find((video) => video.dataset.mediaElementId === elementId);
}

function drawElement(
  context: CanvasRenderingContext2D,
  frame: PresenterRemoteMirrorFrame,
  page: Page,
  element: DesignElement,
  viewport: { height: number; width: number; x: number; y: number },
) {
  const scale = Math.min(viewport.width / page.width, viewport.height / page.height);
  const width = element.width * scale;
  const height = element.height * scale;
  const x = viewport.x + (viewport.width - page.width * scale) / 2 + element.x * scale;
  const y = viewport.y + (viewport.height - page.height * scale) / 2 + element.y * scale;
  context.save();
  context.globalAlpha = element.opacity;
  context.translate(x + width / 2, y + height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.translate(-width / 2, -height / 2);
  if (element.type === 'text') {
    context.fillStyle = element.fill;
    context.font = `${element.fontWeight} ${Math.max(6, element.fontSize * scale)}px ${element.fontFamily}`;
    context.textAlign = element.align;
    context.textBaseline = 'top';
    const textX = element.align === 'center' ? width / 2 : element.align === 'right' ? width : 0;
    drawWrappedText(context, element.text, textX, 0, width, (element.lineHeight ?? 1.05) * element.fontSize * scale, 8);
  } else if (element.type === 'image' || element.type === 'gif') {
    const image = getCachedImage(frame.project.assets[element.assetId]?.objectUrl);
    if (image) context.drawImage(image, 0, 0, width, height);
  } else if (element.type === 'video') {
    const video = getVideoElement(frame.videoElements, element.id);
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      context.drawImage(video, 0, 0, width, height);
    } else {
      context.fillStyle = '#000000';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(55,253,118,0.45)';
      context.strokeRect(0, 0, width, height);
    }
  } else {
    context.fillStyle = element.fill ?? 'transparent';
    context.strokeStyle = element.stroke ?? 'transparent';
    context.lineWidth = (element.strokeWidth ?? 0) * scale;
    if (element.shape === 'ellipse') {
      context.beginPath();
      context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (element.shape === 'line' || element.shape === 'arrow') {
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
    } else {
      context.fillRect(0, 0, width, height);
      if (element.strokeWidth) context.strokeRect(0, 0, width, height);
    }
  }
  context.restore();
}

function drawSlide(
  context: CanvasRenderingContext2D,
  frame: PresenterRemoteMirrorFrame,
  page: Page,
  viewport: { height: number; width: number; x: number; y: number },
) {
  const backgroundAsset = page.background.type === 'asset' ? frame.project.assets[page.background.assetId] : undefined;
  context.fillStyle = page.background.type === 'color' ? page.background.color : page.background.colorFallback;
  context.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
  const backgroundImage = getCachedImage(backgroundAsset?.objectUrl);
  if (backgroundImage) context.drawImage(backgroundImage, viewport.x, viewport.y, viewport.width, viewport.height);
  const hiddenElementIds =
    frame.animationPreview?.pageId === page.id ? new Set(frame.animationPreview.hiddenElementIds) : new Set<string>();
  for (const elementId of page.elementIds) {
    if (hiddenElementIds.has(elementId)) continue;
    const element = frame.project.elements[elementId];
    if (!element || element.visible === false) continue;
    drawElement(context, frame, page, element, viewport);
  }
  context.strokeStyle = 'rgba(241,245,238,0.16)';
  context.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);
}

function drawNotes(context: CanvasRenderingContext2D, notes: string) {
  const y = 560;
  roundedRect(context, 8, y, mirrorSize.width - 16, mirrorSize.height - y - 8, 8);
  context.fillStyle = mirrorNotes;
  context.fill();
  context.fillStyle = '#506050';
  context.font = '700 12px system-ui, sans-serif';
  context.fillText('Notes', 24, y + 24);
  context.fillStyle = '#111b12';
  context.font = '400 28px system-ui, sans-serif';
  drawWrappedText(
    context,
    notes.trim() || 'Presenter notes that are created will appear here',
    24,
    y + 70,
    mirrorSize.width - 48,
    34,
    7,
  );
}

function drawHeader(context: CanvasRenderingContext2D, frame: PresenterRemoteMirrorFrame) {
  context.fillStyle = mirrorText;
  context.font = '700 22px monospace';
  context.fillText(`${frame.activePageIndex + 1} / ${frame.project.pages.length}`, 16, 34);
  context.fillStyle = mirrorGreen;
  context.beginPath();
  context.arc(90, 26, 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = mirrorText;
  context.textAlign = 'center';
  context.fillText(frame.timerLabel, mirrorSize.width / 2, 34);
  context.textAlign = 'right';
  context.fillStyle = mirrorCyan;
  context.fillText('||  ↻  ≡', mirrorSize.width - 16, 34);
  context.textAlign = 'left';
  context.fillStyle = mirrorText;
  context.font = '900 13px system-ui, sans-serif';
  context.fillText(`Current: Slide ${frame.activePageIndex + 1} of ${frame.project.pages.length}`, 16, 82);
  context.textAlign = 'right';
  context.fillText(`Builds remaining: ${frame.buildsRemaining}`, mirrorSize.width - 16, 82);
  context.textAlign = 'left';
}

function drawUpcoming(context: CanvasRenderingContext2D, frame: PresenterRemoteMirrorFrame) {
  const pages = frame.project.pages.slice(frame.activePageIndex + 1, frame.activePageIndex + 4);
  let x = 16;
  for (const [index, page] of pages.entries()) {
    context.fillStyle = mirrorMuted;
    context.font = '800 12px system-ui, sans-serif';
    context.fillText(`Next ${index + 1}`, x, 472);
    drawSlide(context, frame, page, { height: 64, width: 104, x, y: 488 });
    x += 116;
  }
}

function renderFrame(canvas: HTMLCanvasElement, frame: PresenterRemoteMirrorFrame) {
  canvas.width = mirrorSize.width;
  canvas.height = mirrorSize.height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = mirrorBackground;
  context.fillRect(0, 0, mirrorSize.width, mirrorSize.height);
  const gradient = context.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(55,253,118,0.10)');
  gradient.addColorStop(1, 'rgba(55,253,118,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, mirrorSize.width, 180);
  drawHeader(context, frame);
  roundedRect(context, 16, 112, mirrorSize.width - 32, 310, 2);
  context.fillStyle = mirrorPanel;
  context.fill();
  drawSlide(context, frame, frame.activePage, { height: 280, width: mirrorSize.width - 40, x: 20, y: 126 });
  drawUpcoming(context, frame);
  drawNotes(context, frame.notes);
}

export const presenterRemoteMirror = {
  renderFrame,
  size: mirrorSize,
} as const;
