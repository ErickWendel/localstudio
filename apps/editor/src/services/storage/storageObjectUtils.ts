function normalizeObjectKeyPart(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function joinObjectKey(...parts: string[]) {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function jsonBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
}

export const storageObjectUtils = {
  normalizeObjectKeyPart,
  joinObjectKey,
  jsonBlob,
};
