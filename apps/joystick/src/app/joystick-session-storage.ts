import { presenterRemoteSessionCode } from '@localstudio/presenter-remote/session-code';
import type { PresenterRemoteSession } from '@localstudio/presenter-remote/protocol';

const rememberedCodeKey = 'localstudio.joystick.lastCode';
const approvedCodesKey = 'localstudio.joystick.approvedCodes';
const controllerIdKey = 'localstudio.joystick.controllerId';
const trustedPresenterDeviceIdsKey = 'localstudio.joystick.trustedPresenterDeviceIds';

function getLocalStorage() {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function getStoredValue(key: string) {
  return getLocalStorage()?.getItem(key) ?? undefined;
}

function setStoredValue(key: string, value: string) {
  getLocalStorage()?.setItem(key, value);
}

function getStoredStringList(key: string) {
  const value = getStoredValue(key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function setStoredStringList(key: string, values: string[]) {
  getLocalStorage()?.setItem(key, JSON.stringify(values));
}

function addStoredStringListValue(key: string, value: string) {
  if (!value) return;
  const existingValues = getStoredStringList(key);
  const values = [
    value,
    ...existingValues.filter((existingValue) => existingValue !== value),
  ].slice(0, 20);
  setStoredStringList(key, values);
}

function getTrustedPresenterDeviceIds() {
  return new Set(getStoredStringList(trustedPresenterDeviceIdsKey));
}

function getRememberedCode() {
  return presenterRemoteSessionCode.normalize(getStoredValue(rememberedCodeKey) ?? '');
}

function rememberSuccessfulSession(session: PresenterRemoteSession) {
  const code = presenterRemoteSessionCode.normalize(session.code);
  setStoredValue(rememberedCodeKey, code);
  addStoredStringListValue(approvedCodesKey, code);
  addStoredStringListValue(trustedPresenterDeviceIdsKey, session.presenterDeviceId);
}

function getNewestTrustedSession(sessions: PresenterRemoteSession[]) {
  const trustedPresenterDeviceIds = getTrustedPresenterDeviceIds();
  if (trustedPresenterDeviceIds.size === 0) return undefined;
  return sessions
    .filter((session) => trustedPresenterDeviceIds.has(session.presenterDeviceId))
    .sort((left, right) => Date.parse(right.expiresAt) - Date.parse(left.expiresAt))[0];
}

function getControllerId() {
  const existingId = getStoredValue(controllerIdKey);
  if (existingId) return existingId;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `controller-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  setStoredValue(controllerIdKey, id);
  return id;
}

export const joystickSessionStorage = {
  getControllerId,
  getNewestTrustedSession,
  getRememberedCode,
  rememberSuccessfulSession,
};
