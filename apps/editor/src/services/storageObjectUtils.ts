export function normalizeObjectKeyPart(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export function joinObjectKey(...parts: string[]) {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function jsonBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
}
