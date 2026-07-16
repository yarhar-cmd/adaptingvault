import { getRoomDefinition } from '../data/rooms';
import { PLACEHOLDER_DUNGEON_ROOM_ID } from '../data/rooms/placeholderDungeonRoom';
import type {
  AdaptiveRunState,
  ExperiencePreset,
  PlayerBehaviorSignals,
} from '../types/adaptation';
import { isExperiencePreset } from '../types/adaptation';
import type { DungeonProgress, GeneratedRoomSave } from '../types/generation';
import type { CardinalDirection } from '../types/player';
import type {
  EvaluationExitChoice,
  EvaluationProgress,
  ExitDirection,
  RoomDefinition,
  TileCoordinate,
} from '../types/rooms';
import { createAdaptiveRunState, createBehaviorSignals } from '../utils/adaptiveProfile';
import type { GameplayState, RestorableGameplayRun } from '../utils/gameplayState';
import { getTimeSurvived } from '../utils/gameplayState';
import { validateGeneratedRoom } from '../utils/generatedRoomValidator';
import {
  coordinateKey,
  coordinateToGridPosition,
  findSafeSpawn,
  getFloorLookup,
  getWallLookup,
  gridPositionToCoordinate,
  isWalkableCoordinate,
} from '../utils/roomGeometry';
import { isValidEvaluationRoomOrder } from '../utils/roomProgression';
import type { CharacterId } from './runArchive';
import { parseAdaptiveProfile } from './playerProfileStorage';

export const ACTIVE_RUN_KEY = 'mirrorvault:active-run:v1';
export const ACTIVE_RUN_VERSION = 2 as const;
export type ActiveRunStorageIssue = 'invalid' | 'unavailable' | 'write-failed';

export interface ActiveRunRecord {
  version: 1 | 2;
  runId: string;
  characterId: CharacterId;
  status: 'active' | 'defeated';
  elapsedMs: number;
  currentHealth: number;
  maximumHealth: number;
  playerPosition: TileCoordinate;
  facing: CardinalDirection;
  dungeonRoomsCleared?: number;
  roomsCleared?: number;
  enemiesDefeated: number;
  experiencePreset?: ExperiencePreset;
  evaluationProgress: EvaluationProgress;
  dungeonProgress?: DungeonProgress;
  adaptation?: AdaptiveRunState;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function isCharacterId(value: unknown): value is CharacterId {
  return value === 'warden' || value === 'seeker' || value === 'ember';
}
function isFacing(value: unknown): value is CardinalDirection {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}
function isExitDirection(value: unknown): value is ExitDirection {
  return value === 'north' || value === 'south' || value === 'east' || value === 'west';
}
function parseCoordinate(value: unknown): TileCoordinate | null {
  return isObject(value) && Number.isInteger(value.x) && Number.isInteger(value.y)
    ? { x: Number(value.x), y: Number(value.y) }
    : null;
}
function isCoordinate(value: unknown): value is TileCoordinate {
  return parseCoordinate(value) !== null;
}

function parseExitChoice(value: unknown): EvaluationExitChoice | null {
  if (
    !isObject(value) ||
    typeof value.roomId !== 'string' ||
    !isCount(value.roomIndex) ||
    typeof value.exitId !== 'string' ||
    !isExitDirection(value.direction) ||
    !isCount(value.enteredAtMs) ||
    !isCount(value.exitedAtMs) ||
    !isCount(value.timeSpentMs) ||
    value.exitedAtMs < value.enteredAtMs ||
    value.timeSpentMs !== value.exitedAtMs - value.enteredAtMs
  )
    return null;
  return value as unknown as EvaluationExitChoice;
}
function parseEvaluationProgress(value: unknown): EvaluationProgress | null {
  if (
    !isObject(value) ||
    !isValidEvaluationRoomOrder(value.roomOrder) ||
    !isCount(value.currentRoomIndex) ||
    typeof value.currentRoomId !== 'string' ||
    (value.enteredFrom !== null && !isExitDirection(value.enteredFrom)) ||
    !isCount(value.roomEnteredAtMs) ||
    !Array.isArray(value.exitChoices) ||
    typeof value.evaluationComplete !== 'boolean'
  )
    return null;
  if (value.currentRoomIndex > 5) return null;
  if (value.currentRoomIndex < 5 && value.currentRoomId !== value.roomOrder[value.currentRoomIndex])
    return null;
  if (value.currentRoomIndex === 5 && !value.evaluationComplete) return null;
  const exitChoices = value.exitChoices.map(parseExitChoice);
  if (exitChoices.some((choice) => !choice)) return null;
  return {
    roomOrder: [...value.roomOrder],
    currentRoomIndex: value.currentRoomIndex,
    currentRoomId: value.currentRoomId,
    enteredFrom: value.enteredFrom,
    roomEnteredAtMs: value.roomEnteredAtMs,
    exitChoices: exitChoices as EvaluationExitChoice[],
    evaluationComplete: value.evaluationComplete,
  };
}
function parseSignals(value: unknown): PlayerBehaviorSignals | null {
  if (
    !isObject(value) ||
    !Array.isArray(value.roomTimesMs) ||
    !value.roomTimesMs.every(isCount) ||
    !Array.isArray(value.floorTilesVisited) ||
    !value.floorTilesVisited.every((item) => typeof item === 'string') ||
    !isObject(value.exitsChosenByDirection)
  )
    return null;
  for (const key of [
    'movementSteps',
    'blockedMovementAttempts',
    'idleTimeMs',
    'damageTaken',
    'runeContacts',
    'shieldActivations',
    'shieldTimeMs',
    'swordSwings',
    'directionChanges',
  ])
    if (!isCount(value[key])) return null;
  for (const key of ['north', 'south', 'east', 'west'])
    if (!isCount(value.exitsChosenByDirection[key])) return null;
  return value as unknown as PlayerBehaviorSignals;
}
function parseAdaptation(value: unknown): AdaptiveRunState | null {
  if (!isObject(value)) return null;
  const signals = parseSignals(value.signals);
  const currentRunProfile = parseAdaptiveProfile(value.currentRunProfile);
  const effectiveProfile = parseAdaptiveProfile(value.effectiveProfile);
  const baseline = parseSignals(value.currentRoomSignalBaseline);
  if (
    !signals ||
    !currentRunProfile ||
    !effectiveProfile ||
    !baseline ||
    !Array.isArray(value.generatedRoomSignals) ||
    !value.generatedRoomSignals.every(
      (item) => isObject(item) && isCount(item.roomNumber) && parseSignals(item.signals),
    ) ||
    (value.shieldStartedAt !== null && !isCount(value.shieldStartedAt)) ||
    (value.lastMeaningfulActionAt !== null && !isCount(value.lastMeaningfulActionAt))
  )
    return null;
  return {
    signals,
    currentRunProfile,
    effectiveProfile,
    currentRoomSignalBaseline: baseline,
    generatedRoomSignals:
      value.generatedRoomSignals as unknown as AdaptiveRunState['generatedRoomSignals'],
    shieldStartedAt: value.shieldStartedAt as number | null,
    lastMeaningfulActionAt: value.lastMeaningfulActionAt as number | null,
  };
}

function parseRoomSnapshot(value: unknown): RoomDefinition | null {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    value.phase !== 'dungeon' ||
    !isCount(value.width) ||
    !isCount(value.height) ||
    (value.shape !== 'rectangle' && value.shape !== 'l-shape') ||
    !Array.isArray(value.floorTiles) ||
    !value.floorTiles.every(isCoordinate) ||
    !Array.isArray(value.wallTiles) ||
    !value.wallTiles.every(isCoordinate) ||
    !Array.isArray(value.hazards) ||
    !value.hazards.every(isCoordinate) ||
    !Array.isArray(value.exits) ||
    !value.exits.every(
      (exit) =>
        isObject(exit) &&
        typeof exit.id === 'string' &&
        isExitDirection(exit.direction) &&
        isCoordinate(exit.tile) &&
        exit.kind === 'standard' &&
        isObject(exit.condition) &&
        exit.condition.type === 'always' &&
        exit.enabled === true &&
        isObject(exit.destination) &&
        exit.destination.type === 'next-generated-room',
    ) ||
    !isObject(value.entrance) ||
    !isExitDirection(value.entrance.direction) ||
    !isCoordinate(value.entrance.tile) ||
    !isObject(value.spawnPoints) ||
    !isCoordinate(value.spawnPoints[value.entrance.direction])
  )
    return null;
  const room = value as unknown as RoomDefinition;
  try {
    return validateGeneratedRoom(room).valid ? room : null;
  } catch {
    return null;
  }
}
function parseGeneratedSave(value: unknown): GeneratedRoomSave | null {
  if (
    !isObject(value) ||
    value.schemaVersion !== 1 ||
    !isCount(value.generatorVersion) ||
    typeof value.runSeed !== 'string' ||
    !value.runSeed ||
    typeof value.roomSeed !== 'string' ||
    !value.roomSeed ||
    !isCount(value.dungeonRoomNumber) ||
    value.dungeonRoomNumber < 1 ||
    !isObject(value.adaptiveInput) ||
    (value.adaptiveInput.mode !== 'reinforce' && value.adaptiveInput.mode !== 'poke') ||
    !isObject(value.adaptiveInput.shapeWeights) ||
    typeof value.adaptiveInput.shapeWeights.rectangle !== 'number' ||
    typeof value.adaptiveInput.shapeWeights.lShape !== 'number' ||
    !isCount(value.adaptiveInput.minWidth) ||
    !isCount(value.adaptiveInput.maxWidth) ||
    !isCount(value.adaptiveInput.minHeight) ||
    !isCount(value.adaptiveInput.maxHeight) ||
    !isObject(value.adaptiveInput.exitCountWeights) ||
    !isObject(value.adaptiveInput.hazardCountRange) ||
    !isCount(value.adaptiveInput.hazardCountRange.min) ||
    !isCount(value.adaptiveInput.hazardCountRange.max) ||
    !isObject(value.adaptiveInput.hazardPatternWeights) ||
    (value.adaptiveInput.safePathPreference !== 'wide' &&
      value.adaptiveInput.safePathPreference !== 'neutral' &&
      value.adaptiveInput.safePathPreference !== 'narrow') ||
    !isObject(value.details) ||
    value.details.roomSeed !== value.roomSeed ||
    !isCount(value.details.generatorVersion) ||
    (value.details.shape !== 'rectangle' && value.details.shape !== 'l-shape') ||
    !isExitDirection(value.details.entranceDirection) ||
    (value.details.hazardPattern !== 'scattered' && value.details.hazardPattern !== 'clustered') ||
    (value.details.mode !== 'reinforce' &&
      value.details.mode !== 'poke' &&
      value.details.mode !== 'fallback') ||
    !isCount(value.details.retryCount) ||
    !Array.isArray(value.details.validationErrors) ||
    !value.details.validationErrors.every((item) => typeof item === 'string') ||
    !Array.isArray(value.details.reasons) ||
    !value.details.reasons.every((item) => typeof item === 'string')
  )
    return null;
  const roomSnapshot = parseRoomSnapshot(value.roomSnapshot);
  if (
    !roomSnapshot ||
    roomSnapshot.shape !== value.details.shape ||
    roomSnapshot.entrance?.direction !== value.details.entranceDirection
  )
    return null;
  return { ...(value as unknown as GeneratedRoomSave), roomSnapshot };
}
function parseDungeonProgress(value: unknown, runSeed?: string): DungeonProgress | null {
  if (
    !isObject(value) ||
    typeof value.runSeed !== 'string' ||
    !value.runSeed ||
    (runSeed && value.runSeed !== runSeed) ||
    !isCount(value.dungeonRoomNumber) ||
    !Array.isArray(value.chosenExitIds) ||
    !value.chosenExitIds.every((item) => typeof item === 'string') ||
    !isCount(value.pokeCooldown) ||
    (value.enteredFrom !== null && !isExitDirection(value.enteredFrom)) ||
    (value.previousMode !== null &&
      value.previousMode !== 'reinforce' &&
      value.previousMode !== 'poke')
  )
    return null;
  const currentRoom = value.currentRoom === null ? null : parseGeneratedSave(value.currentRoom);
  if (value.currentRoom !== null && !currentRoom) return null;
  if (currentRoom && currentRoom.dungeonRoomNumber !== value.dungeonRoomNumber) return null;
  return {
    runSeed: value.runSeed,
    dungeonRoomNumber: value.dungeonRoomNumber,
    currentRoom,
    enteredFrom: value.enteredFrom as ExitDirection | null,
    chosenExitIds: [...value.chosenExitIds] as string[],
    pokeCooldown: value.pokeCooldown,
    previousMode: value.previousMode as DungeonProgress['previousMode'],
  };
}
function isRestorablePosition(room: RoomDefinition, position: TileCoordinate): boolean {
  if (room.phase === 'dungeon') return isWalkableCoordinate(room, position);
  const key = coordinateKey(position);
  return getFloorLookup(room).has(key) && !getWallLookup(room).has(key);
}

export function parseActiveRunRecord(value: unknown): ActiveRunRecord | null {
  if (
    !isObject(value) ||
    (value.version !== 1 && value.version !== 2) ||
    typeof value.runId !== 'string' ||
    !value.runId ||
    !isCharacterId(value.characterId) ||
    (value.status !== 'active' && value.status !== 'defeated') ||
    !isCount(value.elapsedMs) ||
    !isCount(value.currentHealth) ||
    !isCount(value.maximumHealth) ||
    value.currentHealth > value.maximumHealth ||
    (value.status === 'defeated' && value.currentHealth !== 0) ||
    (value.status === 'active' && value.currentHealth === 0) ||
    !isFacing(value.facing) ||
    !isCount(value.enemiesDefeated)
  )
    return null;
  const playerPosition = parseCoordinate(value.playerPosition);
  const progress = parseEvaluationProgress(value.evaluationProgress);
  if (!playerPosition || !progress || progress.roomEnteredAtMs > value.elapsedMs) return null;
  if (value.version === 1) {
    if (!isCount(value.roomsCleared) || progress.currentRoomId === PLACEHOLDER_DUNGEON_ROOM_ID)
      return null;
    const room = getRoomDefinition(progress.currentRoomId);
    if (!room || !isRestorablePosition(room, playerPosition)) return null;
    const runSeed = `${value.runId}:migrated`;
    return {
      version: 2,
      runId: value.runId,
      characterId: value.characterId,
      status: value.status,
      elapsedMs: value.elapsedMs,
      currentHealth: value.currentHealth,
      maximumHealth: value.maximumHealth,
      playerPosition,
      facing: value.facing,
      dungeonRoomsCleared: 0,
      enemiesDefeated: value.enemiesDefeated,
      experiencePreset: 'seasoned-adventurer',
      evaluationProgress: progress,
      dungeonProgress: {
        runSeed,
        dungeonRoomNumber: 0,
        currentRoom: null,
        enteredFrom: null,
        chosenExitIds: [],
        pokeCooldown: 0,
        previousMode: null,
      },
      adaptation: createAdaptiveRunState(),
    };
  }
  if (!isCount(value.dungeonRoomsCleared) || !isExperiencePreset(value.experiencePreset))
    return null;
  const dungeonProgress = parseDungeonProgress(value.dungeonProgress);
  const adaptation = parseAdaptation(value.adaptation);
  if (!dungeonProgress || !adaptation) return null;
  const room =
    dungeonProgress.currentRoom?.roomSnapshot ?? getRoomDefinition(progress.currentRoomId);
  if (!room || room.id !== progress.currentRoomId || !isRestorablePosition(room, playerPosition))
    return null;
  return {
    version: 2,
    runId: value.runId,
    characterId: value.characterId,
    status: value.status,
    elapsedMs: value.elapsedMs,
    currentHealth: value.currentHealth,
    maximumHealth: value.maximumHealth,
    playerPosition,
    facing: value.facing,
    dungeonRoomsCleared: value.dungeonRoomsCleared,
    enemiesDefeated: value.enemiesDefeated,
    experiencePreset: value.experiencePreset,
    evaluationProgress: progress,
    dungeonProgress,
    adaptation,
  };
}

function resolveStorage(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}
export function loadActiveRun(storage?: Storage): {
  record: ActiveRunRecord | null;
  issue: Exclude<ActiveRunStorageIssue, 'write-failed'> | null;
} {
  try {
    const raw = resolveStorage(storage).getItem(ACTIVE_RUN_KEY);
    if (raw === null) return { record: null, issue: null };
    const record = parseActiveRunRecord(JSON.parse(raw));
    return record ? { record, issue: null } : { record: null, issue: 'invalid' };
  } catch (error) {
    return { record: null, issue: error instanceof SyntaxError ? 'invalid' : 'unavailable' };
  }
}
export function saveActiveRun(
  record: ActiveRunRecord,
  storage?: Storage,
): ActiveRunStorageIssue | null {
  try {
    resolveStorage(storage).setItem(ACTIVE_RUN_KEY, JSON.stringify(record));
    return null;
  } catch {
    return 'write-failed';
  }
}
export function clearActiveRun(storage?: Storage): ActiveRunStorageIssue | null {
  try {
    resolveStorage(storage).removeItem(ACTIVE_RUN_KEY);
    return null;
  } catch {
    return 'unavailable';
  }
}

export function createActiveRunRecord(
  gameplay: GameplayState,
  characterId: CharacterId,
  now: number,
): ActiveRunRecord | null {
  if (
    gameplay.status === 'idle' ||
    !gameplay.runStats.runId ||
    !gameplay.evaluationProgress ||
    !gameplay.dungeonProgress ||
    !gameplay.experiencePreset
  )
    return null;
  return {
    version: 2,
    runId: gameplay.runStats.runId,
    characterId,
    status: gameplay.status,
    elapsedMs: getTimeSurvived(gameplay.runStats, now),
    currentHealth: gameplay.currentHealth,
    maximumHealth: gameplay.maximumHealth,
    playerPosition: gridPositionToCoordinate(gameplay.player.position),
    facing: gameplay.player.facing,
    dungeonRoomsCleared: gameplay.runStats.dungeonRoomsCleared,
    enemiesDefeated: gameplay.runStats.enemiesDefeated,
    experiencePreset: gameplay.experiencePreset,
    evaluationProgress: gameplay.evaluationProgress,
    dungeonProgress: gameplay.dungeonProgress,
    adaptation: gameplay.adaptation,
  };
}
export function toRestorableGameplayRun(record: ActiveRunRecord): RestorableGameplayRun {
  const progress = record.evaluationProgress;
  const dungeon = record.dungeonProgress ?? {
    runSeed: `${record.runId}:migrated`,
    dungeonRoomNumber: 0,
    currentRoom: null,
    enteredFrom: null,
    chosenExitIds: [],
    pokeCooldown: 0,
    previousMode: null,
  };
  const room = dungeon.currentRoom?.roomSnapshot ?? getRoomDefinition(progress.currentRoomId)!;
  const enteredFrom =
    dungeon.currentRoom?.details.entranceDirection ?? progress.enteredFrom ?? 'west';
  const position = isRestorablePosition(room, record.playerPosition)
    ? record.playerPosition
    : findSafeSpawn(room, enteredFrom);
  return {
    status: record.status,
    runId: record.runId,
    elapsedMs: record.elapsedMs,
    currentHealth: record.currentHealth,
    player: { position: coordinateToGridPosition(position), facing: record.facing },
    dungeonRoomsCleared: record.dungeonRoomsCleared ?? 0,
    enemiesDefeated: record.enemiesDefeated,
    experiencePreset: record.experiencePreset ?? 'seasoned-adventurer',
    evaluationProgress: progress,
    dungeonProgress: dungeon,
    adaptation: record.adaptation ?? createAdaptiveRunState(),
  };
}

export { createBehaviorSignals };
