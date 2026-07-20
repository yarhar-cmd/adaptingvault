import { VERSION_INFO } from '../config/version';
import { getRoomDefinition } from '../data/rooms';
import { PLACEHOLDER_DUNGEON_ROOM_ID } from '../data/rooms/placeholderDungeonRoom';
import type {
  AdaptiveRunState,
  CompletedBehaviorSummary,
  ExperiencePreset,
  PlayerBehaviorSignals,
} from '../types/adaptation';
import { isExperiencePreset } from '../types/adaptation';
import type { DungeonProgress, GeneratedRoomSave } from '../types/generation';
import {
  createCombatMetrics,
  type CombatMetrics,
  type StoredEnemyRoomState,
  type StoredRatEnemy,
} from '../types/enemies';
import type { CardinalDirection } from '../types/player';
import type {
  EvaluationExitChoice,
  EvaluationProgress,
  ExitDirection,
  RoomDefinition,
  TileCoordinate,
} from '../types/rooms';
import {
  createAdaptiveRunState,
  createBehaviorSignals,
  subtractSignals,
  summarizeSignals,
} from '../utils/adaptiveProfile';
import type { GameplayState, RestorableGameplayRun, RunPauseState } from '../utils/gameplayState';
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
import { directionBetween } from '../utils/enemySystem';
import type { CharacterId } from './runArchive';
import { parseAdaptiveProfile } from './playerProfileStorage';

export const ACTIVE_RUN_KEY = 'mirrorvault:active-run:v1';
export const ACTIVE_RUN_VERSION = 6 as const;
export type ActiveRunStorageIssue = 'invalid' | 'unavailable' | 'write-failed';

export interface ActiveRunRecord {
  version: 1 | 2 | 3 | 4 | 5 | 6;
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
  pauseState?: RunPauseState;
  timers?: {
    invulnerabilityRemainingMs: number;
    pendingRune: TileCoordinate | null;
    attackCooldownRemainingMs: number;
  };
  enemies?: StoredEnemyRoomState;
  /** Load-only metadata; omitted again after the repaired record is saved. */
  positionRepaired?: boolean;
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

function parsePauseState(value: unknown): RunPauseState | null {
  if (!isObject(value) || typeof value.isPaused !== 'boolean' || !isCount(value.totalPausedMs))
    return null;
  if (!value.isPaused) return { isPaused: false, totalPausedMs: value.totalPausedMs };
  if (value.reason !== 'pause-menu' || !isCount(value.pausedAt)) return null;
  return {
    isPaused: true,
    reason: 'pause-menu',
    pausedAt: value.pausedAt,
    totalPausedMs: value.totalPausedMs,
  };
}

function parseTimers(value: unknown): ActiveRunRecord['timers'] | null {
  if (
    !isObject(value) ||
    !isCount(value.invulnerabilityRemainingMs) ||
    !isCount(value.attackCooldownRemainingMs) ||
    (value.pendingRune !== null && !isCoordinate(value.pendingRune)) ||
    (value.invulnerabilityRemainingMs === 0 && value.pendingRune !== null)
  )
    return null;
  return {
    invulnerabilityRemainingMs: value.invulnerabilityRemainingMs,
    pendingRune: value.pendingRune as TileCoordinate | null,
    attackCooldownRemainingMs: value.attackCooldownRemainingMs,
  };
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
  const combat = Object.fromEntries(
    [
      'ratsSpawned',
      'enemyAttacksStarted',
      'enemyAttacksLanded',
      'enemyAttacksMissed',
      'enemyAttacksBlocked',
      'ratsDamaged',
      'ratsDefeated',
      'swordSwingsAtEnemies',
      'combatTimeMs',
    ].map((key) => [key, isCount(value[key]) ? value[key] : 0]),
  );
  return { ...(value as unknown as PlayerBehaviorSignals), ...combat };
}
function parseCompletedSummary(value: unknown): CompletedBehaviorSummary | null {
  if (!isObject(value) || !isCount(value.roomCount) || !isCount(value.totalRoomTimeMs)) return null;
  for (const key of [
    'movementSteps',
    'blockedMovementAttempts',
    'idleTimeMs',
    'damageTaken',
    'runeContacts',
    'shieldActivations',
    'shieldTimeMs',
    'swordSwings',
    'floorTilesVisitedCount',
    'directionChanges',
  ])
    if (!isCount(value[key])) return null;
  if (!isObject(value.exitsChosenByDirection)) return null;
  for (const direction of ['north', 'south', 'east', 'west'])
    if (!isCount(value.exitsChosenByDirection[direction])) return null;
  const combat = Object.fromEntries(
    [
      'ratsSpawned',
      'enemyAttacksStarted',
      'enemyAttacksLanded',
      'enemyAttacksMissed',
      'enemyAttacksBlocked',
      'ratsDamaged',
      'ratsDefeated',
      'swordSwingsAtEnemies',
      'combatTimeMs',
    ].map((key) => [key, isCount(value[key]) ? value[key] : 0]),
  );
  return { ...(value as unknown as CompletedBehaviorSummary), ...combat };
}

function parseCurrentAdaptation(value: unknown): AdaptiveRunState | null {
  if (!isObject(value)) return null;
  const signals = parseSignals(value.signals);
  const currentRunProfile = parseAdaptiveProfile(value.currentRunProfile);
  const effectiveProfile = parseAdaptiveProfile(value.effectiveProfile);
  const completedSummary = parseCompletedSummary(value.completedSummary);
  if (
    !signals ||
    !currentRunProfile ||
    !effectiveProfile ||
    !completedSummary ||
    signals.roomTimesMs.length > 1 ||
    !Array.isArray(value.generatedRoomSignals) ||
    value.generatedRoomSignals.length > 5 ||
    !value.generatedRoomSignals.every(
      (item) => isObject(item) && isCount(item.roomNumber) && parseSignals(item.signals),
    ) ||
    (value.shieldStartedAt !== null && !isCount(value.shieldStartedAt)) ||
    (value.lastMeaningfulActionAt !== null && !isCount(value.lastMeaningfulActionAt))
  )
    return null;
  const generatedRoomSignals = value.generatedRoomSignals.map((item) => ({
    roomNumber: Number((item as Record<string, unknown>).roomNumber),
    signals: parseSignals((item as Record<string, unknown>).signals)!,
  }));
  return {
    signals,
    completedSummary,
    currentRunProfile,
    effectiveProfile,
    generatedRoomSignals,
    shieldStartedAt: value.shieldStartedAt as number | null,
    lastMeaningfulActionAt: value.lastMeaningfulActionAt as number | null,
  };
}

function parseLegacyAdaptation(value: unknown): AdaptiveRunState | null {
  if (!isObject(value)) return null;
  const wholeSignals = parseSignals(value.signals);
  const baseline = parseSignals(value.currentRoomSignalBaseline);
  const currentRunProfile = parseAdaptiveProfile(value.currentRunProfile);
  const effectiveProfile = parseAdaptiveProfile(value.effectiveProfile);
  if (
    !wholeSignals ||
    !baseline ||
    !currentRunProfile ||
    !effectiveProfile ||
    !Array.isArray(value.generatedRoomSignals) ||
    !value.generatedRoomSignals.every(
      (item) => isObject(item) && isCount(item.roomNumber) && parseSignals(item.signals),
    ) ||
    (value.shieldStartedAt !== null && !isCount(value.shieldStartedAt)) ||
    (value.lastMeaningfulActionAt !== null && !isCount(value.lastMeaningfulActionAt))
  )
    return null;
  const generatedRoomSignals = value.generatedRoomSignals.map((item) => ({
    roomNumber: Number((item as Record<string, unknown>).roomNumber),
    signals: parseSignals((item as Record<string, unknown>).signals)!,
  }));
  return {
    signals: subtractSignals(wholeSignals, baseline),
    completedSummary: summarizeSignals(baseline),
    generatedRoomSignals: generatedRoomSignals.slice(-5),
    currentRunProfile,
    effectiveProfile,
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
        (exit.condition.type === 'always' || exit.condition.type === 'enemies-defeated') &&
        exit.enabled === true &&
        isObject(exit.destination) &&
        exit.destination.type === 'next-generated-room',
    ) ||
    !isObject(value.entrance) ||
    !isExitDirection(value.entrance.direction) ||
    !isCoordinate(value.entrance.tile) ||
    !isObject(value.spawnPoints) ||
    !isCoordinate(value.spawnPoints[value.entrance.direction]) ||
    (value.enemySpawns !== undefined &&
      (!Array.isArray(value.enemySpawns) ||
        !value.enemySpawns.every(
          (spawn) =>
            isObject(spawn) &&
            typeof spawn.id === 'string' &&
            spawn.type === 'rat' &&
            isCoordinate(spawn.tile) &&
            isCount(spawn.order) &&
            (spawn.source === 'authored' || spawn.source === 'generated') &&
            typeof spawn.reason === 'string',
        )))
  )
    return null;
  const room = value as unknown as RoomDefinition;
  try {
    return validateGeneratedRoom(room).valid ? room : null;
  } catch {
    return null;
  }
}
function parseGeneratorVersion(value: unknown): GeneratedRoomSave['generatorVersion'] | null {
  if (value === 1 || value === 'generator-1') return 'generator-1';
  return value === VERSION_INFO.generatorVersion ? VERSION_INFO.generatorVersion : null;
}
function parseGeneratedSave(value: unknown): GeneratedRoomSave | null {
  const generatorVersion = isObject(value) ? parseGeneratorVersion(value.generatorVersion) : null;
  const detailsGeneratorVersion =
    isObject(value) && isObject(value.details)
      ? parseGeneratorVersion(value.details.generatorVersion)
      : null;
  if (
    !isObject(value) ||
    value.schemaVersion !== 1 ||
    generatorVersion === null ||
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
    detailsGeneratorVersion === null ||
    value.details.roomSeed !== value.roomSeed ||
    detailsGeneratorVersion !== generatorVersion ||
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
  return {
    ...(value as unknown as GeneratedRoomSave),
    generatorVersion,
    roomSnapshot,
    details: { ...(value.details as unknown as GeneratedRoomSave['details']), generatorVersion },
  };
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
    chosenExitIds: [...value.chosenExitIds].slice(-5) as string[],
    pokeCooldown: value.pokeCooldown,
    previousMode: value.previousMode as DungeonProgress['previousMode'],
  };
}

function emptyStoredEnemies(roomId: string): StoredEnemyRoomState {
  return {
    roomId,
    rats: [],
    aiFrozen: false,
    countPlan: null,
    lastBlockRemainingMs: 0,
    lastBlockKind: null,
    awarenessGraceRemainingMs: 0,
    combatMetrics: createCombatMetrics(),
  };
}

function parseCombatMetrics(value: unknown): CombatMetrics | null {
  if (!isObject(value)) return null;
  const keys: (keyof CombatMetrics)[] = [
    'attacksStarted',
    'attacksLanded',
    'attacksDodged',
    'regularBlocks',
    'perfectBlocks',
    'attacksCancelledByDefeat',
    'swordSwings',
    'playerHitsLanded',
    'playerDamageTaken',
    'combatDurationMs',
    'maximumSimultaneouslyAlertedRats',
    'bodyLockPreventionActivations',
  ];
  if (keys.some((key) => !isCount(value[key]))) return null;
  return value as unknown as CombatMetrics;
}

function parseEnemyCountPlan(value: unknown): StoredEnemyRoomState['countPlan'] | undefined {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  for (const key of [
    'cap',
    'basePressure',
    'roomSizeAdjustment',
    'shapeAdjustment',
    'hazardAdjustment',
    'adaptationAdjustment',
    'presetAdjustment',
    'requestedCount',
    'selectedCount',
  ])
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) return undefined;
  return value as unknown as NonNullable<StoredEnemyRoomState['countPlan']>;
}

function parseStoredRat(
  value: unknown,
  room: RoomDefinition,
  recordVersion: ActiveRunRecord['version'],
): StoredRatEnemy | null {
  const legacy = recordVersion === 5;
  const state = isObject(value)
    ? legacy
      ? value.state === 'cooldown'
        ? 'recovering'
        : value.state === 'chasing' || value.state === 'telegraphing' || value.state === 'corpse'
          ? value.state
          : null
      : value.state
    : null;
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.type !== 'rat' ||
    !isCoordinate(value.position) ||
    !isCount(value.health) ||
    value.health > 2 ||
    (state !== 'idle' &&
      state !== 'chasing' &&
      state !== 'telegraphing' &&
      state !== 'lunging' &&
      state !== 'recovering' &&
      state !== 'corpse') ||
    (value.lockedTarget !== null && !isCoordinate(value.lockedTarget)) ||
    !isCount(value.movementRemainingMs) ||
    !isCount(value.telegraphRemainingMs) ||
    (!legacy && !isCount(value.lungeRemainingMs)) ||
    (!legacy && !isCount(value.recoveryRemainingMs)) ||
    (legacy && !isCount(value.cooldownRemainingMs)) ||
    !isCount(value.corpseRemainingMs) ||
    !isCount(value.hitFlashRemainingMs) ||
    typeof value.defeatCounted !== 'boolean' ||
    (value.spawnSource !== 'authored' &&
      value.spawnSource !== 'generated' &&
      value.spawnSource !== 'debug' &&
      value.spawnSource !== 'preview') ||
    typeof value.spawnReason !== 'string' ||
    (value.authoredSpawnNumber !== undefined && !isCount(value.authoredSpawnNumber)) ||
    (value.nextPathStep !== null && !isCoordinate(value.nextPathStep))
  )
    return null;
  const position = value.position as TileCoordinate;
  const key = coordinateKey(position);
  if (
    !getFloorLookup(room).has(key) ||
    getWallLookup(room).has(key) ||
    room.exits.some((exit) => coordinateKey(exit.tile) === key)
  )
    return null;
  if (
    (state === 'corpse' &&
      (value.health !== 0 || !value.defeatCounted || value.corpseRemainingMs === 0)) ||
    (state !== 'corpse' && (value.health < 1 || value.defeatCounted)) ||
    (state === 'telegraphing' &&
      (value.telegraphRemainingMs === 0 || value.lockedTarget === null)) ||
    (state === 'lunging' && (!isCount(value.lungeRemainingMs) || value.lungeRemainingMs === 0)) ||
    (state === 'recovering' &&
      (legacy ? value.cooldownRemainingMs === 0 : value.recoveryRemainingMs === 0))
  )
    return null;
  if (legacy) {
    const lockedTarget = value.lockedTarget as TileCoordinate | null;
    return {
      ...(value as unknown as Omit<StoredRatEnemy, 'facing' | 'awareness' | 'state'>),
      state,
      facing: (lockedTarget && directionBetween(position, lockedTarget)) ?? ('left' as const),
      awareness: 'alerted',
      lungeRemainingMs: 0,
      recoveryRemainingMs: state === 'recovering' ? Number(value.cooldownRemainingMs) : 0,
      recoveryKind: state === 'recovering' ? 'standard' : null,
      attackOutcome: null,
      pathDistanceToPlayer: null,
      pathBlocked: false,
    };
  }
  if (
    !isFacing(value.facing) ||
    (value.awareness !== 'unaware' && value.awareness !== 'alerted') ||
    (value.recoveryKind !== null &&
      value.recoveryKind !== 'standard' &&
      value.recoveryKind !== 'perfect-block') ||
    (value.attackOutcome !== null &&
      value.attackOutcome !== 'hit' &&
      value.attackOutcome !== 'miss' &&
      value.attackOutcome !== 'block' &&
      value.attackOutcome !== 'perfect-block') ||
    (value.pathDistanceToPlayer !== null && !isCount(value.pathDistanceToPlayer)) ||
    typeof value.pathBlocked !== 'boolean'
  )
    return null;
  const recoveryKind = value.recoveryKind as StoredRatEnemy['recoveryKind'];
  const attackOutcome = value.attackOutcome as StoredRatEnemy['attackOutcome'];
  if (
    (state === 'idle' && value.awareness !== 'unaware') ||
    (state !== 'idle' && state !== 'corpse' && value.awareness !== 'alerted') ||
    ((state === 'idle' || state === 'chasing' || state === 'telegraphing' || state === 'corpse') &&
      (recoveryKind !== null || attackOutcome !== null)) ||
    ((state === 'lunging' || state === 'recovering') &&
      (value.lockedTarget === null || recoveryKind === null || attackOutcome === null)) ||
    (state !== 'telegraphing' && value.telegraphRemainingMs !== 0) ||
    (state !== 'lunging' && value.lungeRemainingMs !== 0) ||
    (state !== 'recovering' && value.recoveryRemainingMs !== 0)
  )
    return null;
  return { ...(value as unknown as StoredRatEnemy), state };
}

function parseStoredEnemies(
  value: unknown,
  room: RoomDefinition,
  recordVersion: ActiveRunRecord['version'],
): StoredEnemyRoomState | null {
  if (
    !isObject(value) ||
    value.roomId !== room.id ||
    !Array.isArray(value.rats) ||
    value.rats.length > 16 ||
    typeof value.aiFrozen !== 'boolean' ||
    !isCount(value.lastBlockRemainingMs) ||
    (recordVersion === 6 && !isCount(value.awarenessGraceRemainingMs))
  )
    return null;
  const countPlan = parseEnemyCountPlan(value.countPlan);
  if (countPlan === undefined) return null;
  const rats: StoredRatEnemy[] = [];
  for (const raw of value.rats) {
    const rat = parseStoredRat(raw, room, recordVersion);
    if (!rat) {
      if (isObject(raw) && raw.state === 'corpse') continue;
      return null;
    }
    rats.push(rat);
  }
  if (new Set(rats.map((rat) => rat.id)).size !== rats.length) return null;
  const livingPositions = rats
    .filter((rat) => rat.state !== 'corpse')
    .map((rat) => coordinateKey(rat.position));
  if (new Set(livingPositions).size !== livingPositions.length) return null;
  const combatMetrics =
    recordVersion === 6 ? parseCombatMetrics(value.combatMetrics) : createCombatMetrics();
  if (!combatMetrics) return null;
  if (
    recordVersion === 6 &&
    value.lastBlockKind !== null &&
    value.lastBlockKind !== 'regular' &&
    value.lastBlockKind !== 'perfect'
  )
    return null;
  return {
    roomId: room.id,
    rats,
    aiFrozen: value.aiFrozen,
    countPlan,
    lastBlockRemainingMs: value.lastBlockRemainingMs,
    lastBlockKind:
      recordVersion === 6
        ? (value.lastBlockKind as StoredEnemyRoomState['lastBlockKind'])
        : value.lastBlockRemainingMs > 0
          ? 'regular'
          : null,
    awarenessGraceRemainingMs: recordVersion === 6 ? Number(value.awarenessGraceRemainingMs) : 0,
    combatMetrics,
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
    (value.version !== 1 &&
      value.version !== 2 &&
      value.version !== 3 &&
      value.version !== 4 &&
      value.version !== 5 &&
      value.version !== 6) ||
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
      version: 6,
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
      pauseState: { isPaused: false, totalPausedMs: 0 },
      timers: {
        invulnerabilityRemainingMs: 0,
        pendingRune: null,
        attackCooldownRemainingMs: 0,
      },
      enemies: emptyStoredEnemies(progress.currentRoomId),
    };
  }
  if (!isCount(value.dungeonRoomsCleared) || !isExperiencePreset(value.experiencePreset))
    return null;
  const dungeonProgress = parseDungeonProgress(value.dungeonProgress);
  const adaptation =
    value.version >= 4
      ? parseCurrentAdaptation(value.adaptation)
      : parseLegacyAdaptation(value.adaptation);
  if (!dungeonProgress || !adaptation) return null;
  const room =
    dungeonProgress.currentRoom?.roomSnapshot ?? getRoomDefinition(progress.currentRoomId);
  if (!room || room.id !== progress.currentRoomId) return null;
  const enemies =
    value.version >= 5
      ? parseStoredEnemies(value.enemies, room, value.version)
      : emptyStoredEnemies(room.id);
  if (!enemies) return null;
  const livingPositions = new Set(
    enemies.rats.filter((rat) => rat.state !== 'corpse').map((rat) => coordinateKey(rat.position)),
  );
  const positionRepaired =
    !isRestorablePosition(room, playerPosition) ||
    livingPositions.has(coordinateKey(playerPosition));
  const enteredFrom =
    dungeonProgress.currentRoom?.details.entranceDirection ?? progress.enteredFrom ?? 'west';
  const restoredPosition = positionRepaired
    ? findSafeSpawn(room, enteredFrom, playerPosition, (tile) =>
        livingPositions.has(coordinateKey(tile)),
      )
    : playerPosition;
  const pauseState =
    value.version >= 3
      ? parsePauseState(value.pauseState)
      : { isPaused: false as const, totalPausedMs: 0 };
  const timers =
    value.version >= 3
      ? parseTimers(value.timers)
      : {
          invulnerabilityRemainingMs: 0,
          pendingRune: null,
          attackCooldownRemainingMs: 0,
        };
  if (!pauseState || !timers) return null;
  if (value.status === 'defeated' && pauseState.isPaused) return null;
  if (timers.pendingRune && !isRestorablePosition(room, timers.pendingRune)) return null;
  return {
    version: 6,
    runId: value.runId,
    characterId: value.characterId,
    status: value.status,
    elapsedMs: value.elapsedMs,
    currentHealth: value.currentHealth,
    maximumHealth: value.maximumHealth,
    playerPosition: restoredPosition,
    facing: value.facing,
    dungeonRoomsCleared: value.dungeonRoomsCleared,
    enemiesDefeated: value.enemiesDefeated,
    experiencePreset: value.experiencePreset,
    evaluationProgress: progress,
    dungeonProgress,
    adaptation,
    pauseState,
    timers,
    enemies,
    ...(positionRepaired ? { positionRepaired: true } : {}),
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
  const invulnerabilityRemainingMs = remainingDuration(
    gameplay.invulnerability.expiresAt,
    gameplay.pause,
    now,
  );
  return {
    version: 6,
    runId: gameplay.runStats.runId,
    characterId,
    status: gameplay.status,
    elapsedMs: getTimeSurvived(gameplay.runStats, now, gameplay.pause),
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
    pauseState: gameplay.pause,
    timers: {
      invulnerabilityRemainingMs,
      pendingRune:
        invulnerabilityRemainingMs > 0 && gameplay.invulnerability.pendingRune
          ? gridPositionToCoordinate(gameplay.invulnerability.pendingRune)
          : null,
      attackCooldownRemainingMs: remainingDuration(
        gameplay.attackCooldown.readyAt,
        gameplay.pause,
        now,
      ),
    },
    enemies: {
      roomId: gameplay.enemies.roomId,
      aiFrozen: gameplay.enemies.aiFrozen,
      countPlan: gameplay.enemies.countPlan,
      lastBlockRemainingMs: remainingDuration(gameplay.enemies.lastBlockAt, gameplay.pause, now),
      lastBlockKind: gameplay.enemies.lastBlockKind,
      awarenessGraceRemainingMs: remainingDuration(
        gameplay.enemies.awarenessGraceEndsAt,
        gameplay.pause,
        now,
      ),
      combatMetrics: gameplay.enemies.combatMetrics,
      rats: gameplay.enemies.rats.map((rat) => ({
        id: rat.id,
        type: rat.type,
        position: rat.position,
        facing: rat.facing,
        awareness: rat.awareness,
        health: rat.health,
        state: rat.state,
        lockedTarget: rat.lockedTarget,
        movementRemainingMs: remainingDuration(rat.nextMovementAt, gameplay.pause, now),
        telegraphRemainingMs: remainingDuration(rat.telegraphEndsAt, gameplay.pause, now),
        lungeRemainingMs: remainingDuration(rat.lungeEndsAt, gameplay.pause, now),
        recoveryRemainingMs: remainingDuration(rat.recoveryEndsAt, gameplay.pause, now),
        recoveryKind: rat.recoveryKind,
        attackOutcome: rat.attackOutcome,
        corpseRemainingMs: remainingDuration(rat.corpseEndsAt, gameplay.pause, now),
        hitFlashRemainingMs: remainingDuration(rat.hitFlashUntil, gameplay.pause, now),
        defeatCounted: rat.defeatCounted,
        spawnSource: rat.spawnSource,
        spawnReason: rat.spawnReason,
        authoredSpawnNumber: rat.authoredSpawnNumber,
        nextPathStep: rat.nextPathStep,
        pathDistanceToPlayer: rat.pathDistanceToPlayer,
        pathBlocked: rat.pathBlocked,
      })),
    },
  };
}

function remainingDuration(deadline: number | null, pause: RunPauseState, now: number): number {
  if (deadline === null) return 0;
  const referenceTime = pause.isPaused ? pause.pausedAt : now;
  return Math.max(0, Math.trunc(deadline - referenceTime));
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
  const enemies = record.enemies ?? emptyStoredEnemies(room.id);
  const livingPositions = new Set(
    enemies.rats.filter((rat) => rat.state !== 'corpse').map((rat) => coordinateKey(rat.position)),
  );
  const position =
    isRestorablePosition(room, record.playerPosition) &&
    !livingPositions.has(coordinateKey(record.playerPosition))
      ? record.playerPosition
      : findSafeSpawn(room, enteredFrom, record.playerPosition, (tile) =>
          livingPositions.has(coordinateKey(tile)),
        );
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
    enemies,
    pause: record.pauseState ?? { isPaused: false, totalPausedMs: 0 },
    invulnerabilityRemainingMs: record.timers?.invulnerabilityRemainingMs ?? 0,
    pendingRune: record.timers?.pendingRune
      ? coordinateToGridPosition(record.timers.pendingRune)
      : null,
    attackCooldownRemainingMs: record.timers?.attackCooldownRemainingMs ?? 0,
  };
}

export { createBehaviorSignals };
