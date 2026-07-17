import type { GeneratorVersion } from '../config/version';
import type { AdaptiveProfile, ExperiencePreset } from './adaptation';
import type { ExitDirection, RoomDefinition, TileCoordinate } from './rooms';
import type { EnemyCountPlan } from './enemies';

export const GENERATED_ROOM_SAVE_SCHEMA_VERSION = 1;

export type GeneratedRoomMode = 'reinforce' | 'poke' | 'fallback';
export type GeneratedRoomShape = 'rectangle' | 'l-shape';
export type HazardPattern = 'scattered' | 'clustered';

export interface GeneratedRoomParameters {
  mode: Exclude<GeneratedRoomMode, 'fallback'>;
  shapeWeights: { rectangle: number; lShape: number };
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  exitCountWeights: Record<1 | 2 | 3, number>;
  hazardCountRange: { min: number; max: number };
  hazardPatternWeights: { scattered: number; clustered: number };
  safePathPreference: 'wide' | 'neutral' | 'narrow';
}

export interface GeneratedRoomDetails {
  roomSeed: string;
  generatorVersion: GeneratorVersion;
  shape: GeneratedRoomShape;
  entranceDirection: ExitDirection;
  hazardPattern: HazardPattern;
  mode: GeneratedRoomMode;
  retryCount: number;
  validationErrors: string[];
  reasons: string[];
  enemyCountPlan?: EnemyCountPlan;
}

export interface GeneratedRoomSave {
  schemaVersion: number;
  generatorVersion: GeneratorVersion;
  runSeed: string;
  roomSeed: string;
  dungeonRoomNumber: number;
  adaptiveInput: GeneratedRoomParameters;
  roomSnapshot: RoomDefinition;
  details: GeneratedRoomDetails;
}

export interface GenerationRequest {
  runSeed: string;
  dungeonRoomNumber: number;
  chosenExitId: string;
  entranceDirection: ExitDirection;
  experiencePreset: ExperiencePreset;
  effectiveProfile: AdaptiveProfile;
  mode: Exclude<GeneratedRoomMode, 'fallback'>;
}

export interface RoomValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DungeonProgress {
  runSeed: string;
  dungeonRoomNumber: number;
  currentRoom: GeneratedRoomSave | null;
  enteredFrom: ExitDirection | null;
  chosenExitIds: string[];
  pokeCooldown: number;
  previousMode: Exclude<GeneratedRoomMode, 'fallback'> | null;
}

export interface GeneratedExitDestination {
  type: 'next-generated-room';
}

export interface GeneratedEntrance {
  direction: ExitDirection;
  tile: TileCoordinate;
}
