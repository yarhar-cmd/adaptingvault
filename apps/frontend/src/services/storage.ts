import type { RunRecord, UserSettings } from '../types/adventure';

const RUNS_KEY = 'mirrorvault:runs';
const SETTINGS_KEY = 'mirrorvault:settings';
const CHARACTER_KEY = 'mirrorvault:character';

export const defaultSettings: UserSettings = {
  sound: false,
  reducedMotion: false,
  highContrast: false,
};

export function loadRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]') as RunRecord[];
  } catch {
    return [];
  }
}

export function saveRun(run: RunRecord): void {
  localStorage.setItem(RUNS_KEY, JSON.stringify([run, ...loadRuns()].slice(0, 20)));
}

export function clearRuns(): void {
  localStorage.removeItem(RUNS_KEY);
}

export function loadSettings(): UserSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadCharacter(): string {
  return localStorage.getItem(CHARACTER_KEY) ?? 'warden';
}

export function saveCharacter(characterId: string): void {
  localStorage.setItem(CHARACTER_KEY, characterId);
}
