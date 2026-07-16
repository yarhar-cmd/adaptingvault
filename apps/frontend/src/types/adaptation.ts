import type { ExitDirection } from './rooms';

export type ExperiencePreset = 'new-delver' | 'seasoned-adventurer' | 'dungeon-veteran';
export type StoredExperiencePreset = ExperiencePreset | 'unknown';
export type AdaptationRamp = 'slow' | 'medium' | 'fast';

export interface ExperiencePresetTuning {
  label: string;
  reinforceBias: number;
  pokeBias: number;
  adaptationRamp: AdaptationRamp;
}

export const EXPERIENCE_PRESETS: Record<ExperiencePreset, ExperiencePresetTuning> = {
  'new-delver': {
    label: 'New Delver',
    reinforceBias: 0.85,
    pokeBias: 0.15,
    adaptationRamp: 'slow',
  },
  'seasoned-adventurer': {
    label: 'Seasoned Adventurer',
    reinforceBias: 0.75,
    pokeBias: 0.25,
    adaptationRamp: 'medium',
  },
  'dungeon-veteran': {
    label: 'Dungeon Veteran',
    reinforceBias: 0.65,
    pokeBias: 0.35,
    adaptationRamp: 'fast',
  },
};

export const EXPERIENCE_PRESET_IDS = Object.keys(EXPERIENCE_PRESETS) as ExperiencePreset[];

export interface AdaptiveProfile {
  pace: number;
  caution: number;
  aggression: number;
  hazardTolerance: number;
  exploration: number;
}

export type AdaptiveTrait = keyof AdaptiveProfile;

export interface PlayerBehaviorSignals {
  roomTimesMs: number[];
  movementSteps: number;
  blockedMovementAttempts: number;
  idleTimeMs: number;
  damageTaken: number;
  runeContacts: number;
  shieldActivations: number;
  shieldTimeMs: number;
  swordSwings: number;
  floorTilesVisited: string[];
  directionChanges: number;
  exitsChosenByDirection: Record<ExitDirection, number>;
}

export interface RoomBehaviorSnapshot {
  roomNumber: number;
  signals: PlayerBehaviorSignals;
}

export interface AdaptiveRunState {
  signals: PlayerBehaviorSignals;
  generatedRoomSignals: RoomBehaviorSnapshot[];
  currentRunProfile: AdaptiveProfile;
  effectiveProfile: AdaptiveProfile;
  shieldStartedAt: number | null;
  lastMeaningfulActionAt: number | null;
  currentRoomSignalBaseline: PlayerBehaviorSignals;
}

export interface PlayerProfileMetadata {
  completedAdaptiveRooms: number;
  updatedAt: string | null;
}

export interface PlayerProfileRecord {
  version: 1;
  experiencePreset: ExperiencePreset;
  firstTimeComplete: boolean;
  shortcutUnlocked: boolean;
  longTermProfile: AdaptiveProfile;
  metadata: PlayerProfileMetadata;
}

export function isExperiencePreset(value: unknown): value is ExperiencePreset {
  return typeof value === 'string' && EXPERIENCE_PRESET_IDS.includes(value as ExperiencePreset);
}
