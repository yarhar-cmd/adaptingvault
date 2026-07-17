import {
  isExperiencePreset,
  type AdaptiveProfile,
  type ExperiencePreset,
  type PlayerProfileRecord,
} from '../types/adaptation';

export const PLAYER_PROFILE_KEY = 'mirrorvault:player-profile:v1';
export const PLAYER_PROFILE_VERSION = 1 as const;

export type PlayerProfileStorageIssue = 'invalid' | 'unavailable' | 'write-failed';

export const NEUTRAL_ADAPTIVE_PROFILE: AdaptiveProfile = {
  pace: 0.5,
  caution: 0.5,
  aggression: 0.5,
  hazardTolerance: 0.5,
  exploration: 0.5,
};

function resolveStorage(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTrait(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;
}

export function parseAdaptiveProfile(value: unknown): AdaptiveProfile | null {
  if (!isObject(value)) return null;
  const pace = parseTrait(value.pace);
  const caution = parseTrait(value.caution);
  const aggression = parseTrait(value.aggression);
  const hazardTolerance = parseTrait(value.hazardTolerance);
  const exploration = parseTrait(value.exploration);
  if ([pace, caution, aggression, hazardTolerance, exploration].some((item) => item === null)) {
    return null;
  }
  return {
    pace: pace!,
    caution: caution!,
    aggression: aggression!,
    hazardTolerance: hazardTolerance!,
    exploration: exploration!,
  };
}

export function createPlayerProfile(experiencePreset: ExperiencePreset): PlayerProfileRecord {
  return {
    version: PLAYER_PROFILE_VERSION,
    experiencePreset,
    firstTimeComplete: true,
    shortcutUnlocked: false,
    longTermProfile: { ...NEUTRAL_ADAPTIVE_PROFILE },
    metadata: { completedAdaptiveRooms: 0, updatedAt: null },
  };
}

export function parsePlayerProfile(value: unknown): PlayerProfileRecord | null {
  if (
    !isObject(value) ||
    value.version !== PLAYER_PROFILE_VERSION ||
    !isExperiencePreset(value.experiencePreset) ||
    typeof value.firstTimeComplete !== 'boolean' ||
    typeof value.shortcutUnlocked !== 'boolean' ||
    !isObject(value.metadata) ||
    !Number.isSafeInteger(value.metadata.completedAdaptiveRooms) ||
    Number(value.metadata.completedAdaptiveRooms) < 0 ||
    (value.metadata.updatedAt !== null && typeof value.metadata.updatedAt !== 'string')
  ) {
    return null;
  }
  const longTermProfile = parseAdaptiveProfile(value.longTermProfile);
  if (!longTermProfile) return null;
  return {
    version: PLAYER_PROFILE_VERSION,
    experiencePreset: value.experiencePreset,
    firstTimeComplete: value.firstTimeComplete,
    shortcutUnlocked: value.shortcutUnlocked,
    longTermProfile,
    metadata: {
      completedAdaptiveRooms: Number(value.metadata.completedAdaptiveRooms),
      updatedAt: value.metadata.updatedAt as string | null,
    },
  };
}

export function loadPlayerProfile(storage?: Storage): {
  record: PlayerProfileRecord | null;
  issue: Exclude<PlayerProfileStorageIssue, 'write-failed'> | null;
  recoveredExperiencePreset?: ExperiencePreset;
} {
  try {
    const raw = resolveStorage(storage).getItem(PLAYER_PROFILE_KEY);
    if (raw === null) return { record: null, issue: null };
    const parsed = JSON.parse(raw) as unknown;
    const record = parsePlayerProfile(parsed);
    if (record) return { record, issue: null };
    const recoveredExperiencePreset =
      isObject(parsed) && isExperiencePreset(parsed.experiencePreset)
        ? parsed.experiencePreset
        : undefined;
    return { record: null, issue: 'invalid', recoveredExperiencePreset };
  } catch (error) {
    return { record: null, issue: error instanceof SyntaxError ? 'invalid' : 'unavailable' };
  }
}

export function clearPlayerProfile(storage?: Storage): PlayerProfileStorageIssue | null {
  try {
    resolveStorage(storage).removeItem(PLAYER_PROFILE_KEY);
    return null;
  } catch {
    return 'unavailable';
  }
}

export function savePlayerProfile(
  profile: PlayerProfileRecord,
  storage?: Storage,
): PlayerProfileStorageIssue | null {
  try {
    resolveStorage(storage).setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    return null;
  } catch {
    return 'write-failed';
  }
}

export function resetPlayerProfile(
  current: PlayerProfileRecord,
  clearFirstTimeStatus: boolean,
): PlayerProfileRecord {
  return {
    ...createPlayerProfile(current.experiencePreset),
    firstTimeComplete: !clearFirstTimeStatus,
  };
}

export function changeExperiencePreset(
  _current: PlayerProfileRecord,
  experiencePreset: ExperiencePreset,
): PlayerProfileRecord {
  return { ...createPlayerProfile(experiencePreset), firstTimeComplete: true };
}
