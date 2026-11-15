import {emptySettings, type Diagnosis, type Settings} from '../../shared/proxy';

export const SETTINGS_KEY = 'settings';
export const ERRORS_KEY = 'errors';

export type ErrorEvent = Diagnosis & {at: string; raw: string};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY];
  if (!value || typeof value !== 'object') return emptySettings();
  const record = value as Partial<Settings>;
  return {
    enabled: Boolean(record.enabled),
    defaultProfileId: typeof record.defaultProfileId === 'string' ? record.defaultProfileId : 'direct',
    profiles: Array.isArray(record.profiles) ? record.profiles : [],
    rules: Array.isArray(record.rules) ? record.rules : [],
    blockWebRtcLeak: record.blockWebRtcLeak !== false,
  };
}

export function saveSettings(settings: Settings): Promise<void> {
  return chrome.storage.local.set({[SETTINGS_KEY]: settings});
}

export async function loadErrors(): Promise<ErrorEvent[]> {
  const stored = await chrome.storage.local.get(ERRORS_KEY);
  return Array.isArray(stored[ERRORS_KEY]) ? stored[ERRORS_KEY] as ErrorEvent[] : [];
}
