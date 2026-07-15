import { presenterRemoteSessionCode } from '@localstudio/presenter-remote/session-code';

function normalizePeerInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';
  try {
    const url = new URL(trimmedValue);
    return url.searchParams.get('peer')?.trim() ?? '';
  } catch {
    if (presenterRemoteSessionCode.isValid(presenterRemoteSessionCode.normalize(trimmedValue))) return '';
    return trimmedValue;
  }
}

function getCode(value: string) {
  let code: string;
  try {
    const url = new URL(value);
    code = presenterRemoteSessionCode.normalize(url.searchParams.get('code') ?? '');
  } catch {
    code = presenterRemoteSessionCode.normalize(value);
  }
  return presenterRemoteSessionCode.isValid(code) ? code : '';
}

export const joystickRemoteLink = {
  getCode,
  getPeerId: normalizePeerInput,
} as const;
