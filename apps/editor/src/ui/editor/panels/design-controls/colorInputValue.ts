function isHexColor(value: string) {
  return /^#[\da-f]{6}$/i.test(value);
}

function expandShortHexColor(value: string) {
  if (!/^#[\da-f]{3}$/i.test(value)) return undefined;
  return `#${value
    .slice(1)
    .split('')
    .map((channel) => `${channel}${channel}`)
    .join('')}`;
}

export function colorInputValue(value: string | undefined) {
  const normalized = value?.trim() ?? '';
  if (isHexColor(normalized)) return normalized.toLowerCase();
  return expandShortHexColor(normalized)?.toLowerCase() ?? '#000000';
}
