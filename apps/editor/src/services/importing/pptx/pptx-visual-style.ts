import { pptxXml } from './pptxXml';
import type { PptxTheme } from './pptx-parser-model';

function normalizeColor(value: string) {
  return `#${value.replace(/^#/, '').toUpperCase()}`;
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyColorModifier(color: string, element: Element) {
  const hex = color.replace(/^#/, '');
  let red = Number.parseInt(hex.slice(0, 2), 16);
  let green = Number.parseInt(hex.slice(2, 4), 16);
  let blue = Number.parseInt(hex.slice(4, 6), 16);
  const shade = Number(pptxXml.firstDescendant(element, 'shade')?.getAttribute('val'));
  const tint = Number(pptxXml.firstDescendant(element, 'tint')?.getAttribute('val'));
  const lumMod = Number(pptxXml.firstDescendant(element, 'lumMod')?.getAttribute('val'));
  const lumOff = Number(pptxXml.firstDescendant(element, 'lumOff')?.getAttribute('val'));
  if (Number.isFinite(shade) && shade >= 0) {
    red = (red * shade) / 100000;
    green = (green * shade) / 100000;
    blue = (blue * shade) / 100000;
  }
  if (Number.isFinite(tint) && tint >= 0) {
    red += (255 - red) * (tint / 100000);
    green += (255 - green) * (tint / 100000);
    blue += (255 - blue) * (tint / 100000);
  }
  if (Number.isFinite(lumMod) && lumMod >= 0) {
    red *= lumMod / 100000;
    green *= lumMod / 100000;
    blue *= lumMod / 100000;
  }
  if (Number.isFinite(lumOff) && lumOff >= 0) {
    red += 255 * (lumOff / 100000);
    green += 255 * (lumOff / 100000);
    blue += 255 * (lumOff / 100000);
  }
  return normalizeColor(
    [red, green, blue].map((channel) => clampColor(channel).toString(16).padStart(2, '0')).join(''),
  );
}

function getThemeColor(theme: PptxTheme | undefined, name: string) {
  const aliases = new Map([
    ['bg1', 'lt1'],
    ['tx1', 'dk1'],
    ['bg2', 'lt2'],
    ['tx2', 'dk2'],
  ]);
  return theme?.colors.get(name) ?? theme?.colors.get(aliases.get(name) ?? '');
}

function getHexColor(element: ParentNode | undefined, fallback: string, theme?: PptxTheme) {
  if (!element) return fallback;
  const color = pptxXml.firstDescendant(element, 'srgbClr');
  const schemeColor = pptxXml.firstDescendant(element, 'schemeClr');
  const systemColor = pptxXml.firstDescendant(element, 'sysClr');
  const rawColor =
    color?.getAttribute('val') ??
    systemColor?.getAttribute('lastClr') ??
    (schemeColor ? getThemeColor(theme, schemeColor.getAttribute('val') ?? '') : undefined);
  const sourceElement = color ?? schemeColor ?? systemColor;
  return rawColor && sourceElement ? applyColorModifier(normalizeColor(rawColor), sourceElement) : fallback;
}

function toUnitInterval(value: string | null | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.max(0, Math.min(1, numericValue / 100000))
    : undefined;
}

function getOpacity(element: ParentNode | undefined) {
  if (!element) return undefined;
  const blip = pptxXml.firstDescendant(element, 'blip');
  const blipAlpha = blip
    ? toUnitInterval(pptxXml.firstDescendant(blip, 'alpha')?.getAttribute('val')) ??
      toUnitInterval(pptxXml.firstDescendant(blip, 'alphaModFix')?.getAttribute('amt')) ??
      toUnitInterval(pptxXml.firstDescendant(blip, 'alphaMod')?.getAttribute('amt'))
    : undefined;
  if (blipAlpha !== undefined) return blipAlpha;
  const solidFill = pptxXml.firstDescendant(element, 'solidFill');
  return solidFill
    ? toUnitInterval(pptxXml.firstDescendant(solidFill, 'alpha')?.getAttribute('val'))
    : undefined;
}

export const pptxVisualStyle = {
  getHexColor,
  getOpacity,
};
