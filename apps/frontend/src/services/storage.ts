import type { UserSettings } from '../types/adventure';
import { getPlayableCharacterId } from '../data/characterAvailability';

const SETTINGS_KEY = 'mirrorvault:settings';
const CHARACTER_KEY = 'mirrorvault:character';
export type SettingsStorageIssue = 'invalid' | 'unavailable' | 'write-failed';

export const defaultSettings: UserSettings = {
  sound: false,
  reducedMotion: false,
  highContrast: false,
};

export function loadSettings(): UserSettings {
  return loadSettingsResult().settings;
}

export function loadSettingsResult(storage: Storage = localStorage): {
  settings: UserSettings;
  issue: Exclude<SettingsStorageIssue, 'write-failed'> | null;
} {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null) return { settings: defaultSettings, issue: null };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      typeof (parsed as UserSettings).sound !== 'boolean' ||
      typeof (parsed as UserSettings).reducedMotion !== 'boolean' ||
      typeof (parsed as UserSettings).highContrast !== 'boolean'
    )
      return { settings: defaultSettings, issue: 'invalid' };
    return { settings: parsed as UserSettings, issue: null };
  } catch (error) {
    return {
      settings: defaultSettings,
      issue: error instanceof SyntaxError ? 'invalid' : 'unavailable',
    };
  }
}

export function saveSettings(
  settings: UserSettings,
  storage: Storage = localStorage,
): SettingsStorageIssue | null {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return null;
  } catch {
    return 'write-failed';
  }
}

export function loadCharacter(): string {
  return getPlayableCharacterId(localStorage.getItem(CHARACTER_KEY) ?? 'warden');
}

export function saveCharacter(characterId: string): SettingsStorageIssue | null {
  try {
    localStorage.setItem(CHARACTER_KEY, getPlayableCharacterId(characterId));
    return null;
  } catch {
    return 'write-failed';
  }
}
