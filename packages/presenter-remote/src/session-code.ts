const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const codePattern = /^[A-HJ-NP-Z1-9]{4}-[A-HJ-NP-Z1-9]{4}$/;

function create(random = Math.random) {
  let rawCode = '';
  for (let index = 0; index < 8; index += 1) {
    rawCode += codeAlphabet[Math.floor(random() * codeAlphabet.length)] ?? 'A';
  }
  return `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`;
}

function normalize(value: string) {
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

function isValid(value: string) {
  return codePattern.test(normalize(value));
}

export const presenterRemoteSessionCode = {
  create,
  isValid,
  normalize,
} as const;
