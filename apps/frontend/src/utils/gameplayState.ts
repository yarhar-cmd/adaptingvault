import { CURRENT_ROOM_LAYOUT, isHazardPosition } from '../data/roomLayout';
import type {
  AdaptiveProfile,
  AdaptiveRunState,
  ExperiencePreset,
  PlayerBehaviorSignals,
  RoomBehaviorSnapshot,
} from '../types/adaptation';
import type { DungeonProgress, GeneratedRoomSave } from '../types/generation';
import type { EnemyRoomState, RatEnemy, StoredEnemyRoomState } from '../types/enemies';
import {
  PLAYER_DAMAGE_INVULNERABILITY_MS,
  RAT_ATTACK_COOLDOWN_MS,
  RAT_ATTACK_DAMAGE,
  RAT_ATTACK_TELEGRAPH_MS,
  RAT_CORPSE_ABSORPTION_MS,
  RAT_MOVEMENT_INTERVAL_MS,
} from '../types/enemies';
import type {
  AttackAction,
  CardinalDirection,
  GridPosition,
  MoveResult,
  MoveTrigger,
  PlayerState,
} from '../types/player';
import type {
  EvaluationExitChoice,
  EvaluationProgress,
  ExitDirection,
  RoomDefinition,
} from '../types/rooms';
import {
  createAdaptiveRunState,
  addSignalsToSummary,
  createBehaviorSignals,
  updateCurrentRunProfile,
} from './adaptiveProfile';
import {
  coordinateToGridPosition,
  coordinatesMatch,
  gridPositionToCoordinate,
  isWalkableCoordinate,
  roomBounds,
} from './roomGeometry';
import { attemptMove, createAttackAction, positionsMatch, turnPlayer } from './playerActions';
import {
  cardinalDistance,
  createRatFromSpawn,
  directionFromPlayerToRat,
  emptyEnemyRoomState,
  isLivingRat,
  livingRats,
  nextRatPathStep,
} from './enemySystem';
import { coordinateKey } from './roomGeometry';

export const INVULNERABILITY_DURATION_MS = PLAYER_DAMAGE_INVULNERABILITY_MS;
export const ATTACK_COOLDOWN_MS = 400;
const IDLE_THRESHOLD_MS = 1_000;

export type GameplayStatus = 'idle' | 'active' | 'defeated';
export type DamageSource = 'rune' | 'rat';

export interface DamageEvent {
  id: string;
  source: DamageSource;
  amount: number;
  timestamp: number;
  fatal: boolean;
}
export interface AvoidedDamageEvent {
  id: string;
  source: DamageSource;
  position: GridPosition;
  timestamp: number;
}
export interface InvulnerabilityState {
  expiresAt: number | null;
  pendingRune: GridPosition | null;
}
export type RunPauseState =
  | { isPaused: false; totalPausedMs: number }
  | {
      isPaused: true;
      reason: 'pause-menu';
      pausedAt: number;
      totalPausedMs: number;
    };
export interface AttackCooldownState {
  readyAt: number | null;
}
export interface RunStats {
  runId: string | null;
  startedAt: number | null;
  timeSurvived: number | null;
  dungeonRoomsCleared: number;
  /** Compatibility alias for older UI/tests; always equals dungeonRoomsCleared. */
  roomsCleared: number;
  enemiesDefeated: number;
}

export interface GameplayState {
  status: GameplayStatus;
  player: PlayerState;
  currentHealth: number;
  maximumHealth: number;
  invulnerability: InvulnerabilityState;
  pause: RunPauseState;
  attackCooldown: AttackCooldownState;
  runStats: RunStats;
  experiencePreset: ExperiencePreset | null;
  evaluationProgress: EvaluationProgress | null;
  dungeonProgress: DungeonProgress | null;
  adaptation: AdaptiveRunState;
  enemies: EnemyRoomState;
  lastMove: MoveResult | null;
  blockedMove: MoveResult | null;
  lastAttack: AttackAction | null;
  lastDamage: DamageEvent | null;
  lastAvoidedDamage: AvoidedDamageEvent | null;
  announcement: string;
}

export type GameplayAction =
  | {
      type: 'start-run';
      maximumHealth: number;
      startedAt: number;
      runId: string;
      roomOrder?: string[];
      currentRoomId?: string;
      spawn?: GridPosition;
      experiencePreset?: ExperiencePreset;
      longTermProfile?: AdaptiveProfile;
      runSeed?: string;
      enemies?: EnemyRoomState;
    }
  | { type: 'reset-room' }
  | { type: 'reset-to-idle'; maximumHealth: number }
  | { type: 'pause-run'; timestamp: number; reason: 'pause-menu' }
  | { type: 'resume-run'; timestamp: number }
  | {
      type: 'move';
      direction: CardinalDirection;
      trigger: MoveTrigger;
      id: string;
      timestamp: number;
      hazards?: readonly GridPosition[];
      room?: RoomDefinition;
    }
  | { type: 'turn'; direction: CardinalDirection; trigger: MoveTrigger; timestamp?: number }
  | { type: 'attack'; id: string; timestamp: number; room?: RoomDefinition }
  | { type: 'shield'; isShielding: boolean; timestamp?: number }
  | {
      type: 'commit-room-transition';
      destinationRoomId: string;
      destinationRoomIndex: number;
      destinationSpawn: GridPosition;
      enteredFrom: ExitDirection;
      exitedAtMs: number;
      exitChoice: EvaluationExitChoice | null;
      evaluationComplete: boolean;
      generatedRoom?: GeneratedRoomSave;
      incrementDungeonRooms?: boolean;
      chosenExitId?: string;
      nextPokeCooldown?: number;
      nextMode?: 'reinforce' | 'poke';
      longTermProfile?: AdaptiveProfile;
      exitDirection?: ExitDirection;
      effectiveProfile?: AdaptiveProfile;
      enemies?: EnemyRoomState;
    }
  | { type: 'enemy-tick'; timestamp: number; room: RoomDefinition }
  | { type: 'debug-spawn-rat'; timestamp: number; room: RoomDefinition }
  | { type: 'debug-defeat-all-enemies'; timestamp: number }
  | { type: 'debug-freeze-enemy-ai'; frozen: boolean }
  | { type: 'shift-enemy-timers'; duration: number }
  | { type: 'apply-debug-profile'; profile: AdaptiveProfile }
  | {
      type: 'invulnerability-expired';
      runId: string;
      expectedExpiresAt: number;
      timestamp: number;
    };

const legacyCollisionContext = { bounds: CURRENT_ROOM_LAYOUT.bounds, isBlocked: () => false };
function getCollisionContext(room?: RoomDefinition, enemies?: EnemyRoomState) {
  const living = enemies ? livingRats(enemies) : [];
  const occupied = new Set(living.map((rat) => coordinateKey(rat.position)));
  return room
    ? {
        bounds: roomBounds(room),
        isBlocked: (position: GridPosition) =>
          !isWalkableCoordinate(room, gridPositionToCoordinate(position), living.length) ||
          occupied.has(coordinateKey(gridPositionToCoordinate(position))),
      }
    : legacyCollisionContext;
}
function createPlayer(position: GridPosition = { row: 2, column: 0 }): PlayerState {
  return { position, facing: 'right', isShielding: false, shieldDirection: null };
}
function createRunStats(): RunStats {
  return {
    runId: null,
    startedAt: null,
    timeSurvived: null,
    dungeonRoomsCleared: 0,
    roomsCleared: 0,
    enemiesDefeated: 0,
  };
}
function createInvulnerabilityState(): InvulnerabilityState {
  return { expiresAt: null, pendingRune: null };
}
function createPauseState(): RunPauseState {
  return { isPaused: false, totalPausedMs: 0 };
}
function createAttackCooldownState(): AttackCooldownState {
  return { readyAt: null };
}
function clampHealth(health: number, maximumHealth: number): number {
  return Math.min(Math.max(0, health), maximumHealth);
}

export function createGameplayState(maximumHealth: number): GameplayState {
  const safeMaximumHealth = Math.max(0, Math.trunc(maximumHealth));
  return {
    status: 'idle',
    player: createPlayer(),
    currentHealth: safeMaximumHealth,
    maximumHealth: safeMaximumHealth,
    invulnerability: createInvulnerabilityState(),
    pause: createPauseState(),
    attackCooldown: createAttackCooldownState(),
    runStats: createRunStats(),
    experiencePreset: null,
    evaluationProgress: null,
    dungeonProgress: null,
    adaptation: createAdaptiveRunState(),
    enemies: emptyEnemyRoomState(),
    lastMove: null,
    blockedMove: null,
    lastAttack: null,
    lastDamage: null,
    lastAvoidedDamage: null,
    announcement: '',
  };
}

function withMeaningfulAction(adaptation: AdaptiveRunState, timestamp: number): AdaptiveRunState {
  const previous = adaptation.lastMeaningfulActionAt;
  const idle = previous === null ? 0 : Math.max(0, timestamp - previous - IDLE_THRESHOLD_MS);
  return {
    ...adaptation,
    signals: { ...adaptation.signals, idleTimeMs: adaptation.signals.idleTimeMs + idle },
    lastMeaningfulActionAt: timestamp,
  };
}

export function applyPlayerDamage(
  state: GameplayState,
  event: Omit<DamageEvent, 'fatal'>,
): GameplayState {
  if (state.status !== 'active' || event.amount <= 0) return state;
  if (state.invulnerability.expiresAt !== null && event.timestamp < state.invulnerability.expiresAt)
    return state;
  const currentHealth = clampHealth(state.currentHealth - event.amount, state.maximumHealth);
  const fatal = currentHealth === 0;
  const timeSurvived = fatal
    ? getTimeSurvived(state.runStats, event.timestamp, state.pause)
    : state.runStats.timeSurvived;
  return {
    ...state,
    status: fatal ? 'defeated' : 'active',
    player: fatal ? { ...state.player, isShielding: false, shieldDirection: null } : state.player,
    currentHealth,
    invulnerability: fatal
      ? createInvulnerabilityState()
      : { expiresAt: event.timestamp + INVULNERABILITY_DURATION_MS, pendingRune: null },
    attackCooldown: fatal ? createAttackCooldownState() : state.attackCooldown,
    runStats: fatal ? { ...state.runStats, timeSurvived } : state.runStats,
    adaptation: {
      ...state.adaptation,
      signals: {
        ...state.adaptation.signals,
        damageTaken: state.adaptation.signals.damageTaken + event.amount,
      },
    },
    lastAttack: fatal ? null : state.lastAttack,
    lastDamage: { ...event, fatal },
    lastAvoidedDamage: null,
    announcement: fatal
      ? 'You were defeated.'
      : `${event.source === 'rat' ? 'Rat' : 'Rune'} damaged you. ${currentHealth} of ${state.maximumHealth} health remaining.`,
  };
}

function movePlayer(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'move' }>,
): GameplayState {
  const movement = attemptMove(
    state.player,
    action.direction,
    getCollisionContext(action.room, state.enemies),
    action.id,
  );
  const meaningful = action.trigger !== 'repeat';
  const shouldShowBlockedFeedback =
    movement.result.blockedReason !== null &&
    (meaningful ||
      state.lastMove?.blockedReason === null ||
      state.lastMove?.facing !== movement.result.facing);
  const invulnerabilityActive =
    state.invulnerability.expiresAt !== null && action.timestamp < state.invulnerability.expiresAt;
  let adaptation = meaningful
    ? withMeaningfulAction(state.adaptation, action.timestamp)
    : state.adaptation;
  const visited = new Set(adaptation.signals.floorTilesVisited);
  if (movement.result.moved)
    visited.add(
      `${action.room?.id ?? 'legacy'}:${movement.result.target.column}:${movement.result.target.row}`,
    );
  adaptation = {
    ...adaptation,
    signals: {
      ...adaptation.signals,
      movementSteps:
        adaptation.signals.movementSteps + (movement.result.moved && meaningful ? 1 : 0),
      blockedMovementAttempts:
        adaptation.signals.blockedMovementAttempts + (!movement.result.moved && meaningful ? 1 : 0),
      directionChanges:
        adaptation.signals.directionChanges +
        (state.player.facing !== action.direction && meaningful ? 1 : 0),
      floorTilesVisited: [...visited],
    },
  };
  let nextState: GameplayState = {
    ...state,
    player: movement.player,
    adaptation,
    invulnerability: invulnerabilityActive ? state.invulnerability : createInvulnerabilityState(),
    lastMove: movement.result,
    blockedMove: shouldShowBlockedFeedback ? movement.result : state.blockedMove,
    announcement:
      meaningful || shouldShowBlockedFeedback
        ? movement.result.moved
          ? `Moved ${movement.result.facing}.`
          : `Blocked moving ${movement.result.facing}.`
        : state.announcement,
  };
  if (!movement.result.moved) return nextState;
  const hazards = action.room
    ? (action.room.hazards ?? []).map(coordinateToGridPosition)
    : (action.hazards ?? CURRENT_ROOM_LAYOUT.hazards);
  if (!isHazardPosition(movement.result.target, hazards)) {
    return nextState.invulnerability.pendingRune === null
      ? nextState
      : { ...nextState, invulnerability: { ...nextState.invulnerability, pendingRune: null } };
  }
  nextState = {
    ...nextState,
    adaptation: {
      ...nextState.adaptation,
      signals: {
        ...nextState.adaptation.signals,
        runeContacts: nextState.adaptation.signals.runeContacts + 1,
      },
    },
  };
  if (invulnerabilityActive) {
    return {
      ...nextState,
      invulnerability: { ...nextState.invulnerability, pendingRune: movement.result.target },
      lastAvoidedDamage: {
        id: action.id,
        source: 'rune',
        position: movement.result.target,
        timestamp: action.timestamp,
      },
      announcement: 'Damage avoided while invulnerable.',
    };
  }
  return applyPlayerDamage(nextState, {
    id: action.id,
    source: 'rune',
    amount: 1,
    timestamp: action.timestamp,
  });
}

function shiftRatDeadline(value: number | null, duration: number): number | null {
  return value === null ? null : value + duration;
}

function shiftEnemyTimers(enemies: EnemyRoomState, duration: number): EnemyRoomState {
  return {
    ...enemies,
    lastTickAt: shiftRatDeadline(enemies.lastTickAt, duration),
    lastBlockAt: shiftRatDeadline(enemies.lastBlockAt, duration),
    rats: enemies.rats.map((rat) => ({
      ...rat,
      nextMovementAt: shiftRatDeadline(rat.nextMovementAt, duration),
      telegraphEndsAt: shiftRatDeadline(rat.telegraphEndsAt, duration),
      cooldownEndsAt: shiftRatDeadline(rat.cooldownEndsAt, duration),
      corpseEndsAt: shiftRatDeadline(rat.corpseEndsAt, duration),
      hitFlashUntil: shiftRatDeadline(rat.hitFlashUntil, duration),
    })),
  };
}

function defeatRat(rat: RatEnemy, timestamp: number): RatEnemy {
  return {
    ...rat,
    health: 0,
    state: 'corpse',
    lockedTarget: null,
    nextMovementAt: null,
    telegraphEndsAt: null,
    cooldownEndsAt: null,
    corpseEndsAt: timestamp + RAT_CORPSE_ABSORPTION_MS,
    hitFlashUntil: null,
    defeatCounted: true,
    nextPathStep: null,
  };
}

function applySwordToRats(
  state: GameplayState,
  attack: AttackAction,
  timestamp: number,
): { enemies: EnemyRoomState; defeated: number; damaged: number; hit: boolean } {
  if (!attack.target || attack.blockedReason) {
    return { enemies: state.enemies, defeated: 0, damaged: 0, hit: false };
  }
  const target = gridPositionToCoordinate(attack.target);
  let defeated = 0;
  let damaged = 0;
  const rats = state.enemies.rats.map((rat) => {
    if (!isLivingRat(rat) || !coordinatesMatch(rat.position, target)) return rat;
    damaged += 1;
    if (rat.health <= attack.damage) {
      defeated += rat.defeatCounted ? 0 : 1;
      return defeatRat(rat, timestamp);
    }
    return { ...rat, health: rat.health - attack.damage, hitFlashUntil: timestamp + 140 };
  });
  return {
    enemies: { ...state.enemies, rats },
    defeated,
    damaged,
    hit: damaged > 0,
  };
}

function processEnemyTick(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'enemy-tick' }>,
): GameplayState {
  if (state.pause.isPaused || state.status !== 'active') return state;
  const timestamp = action.timestamp;
  if (state.enemies.aiFrozen) {
    const frozenDuration =
      state.enemies.lastTickAt === null ? 0 : Math.max(0, timestamp - state.enemies.lastTickAt);
    return {
      ...state,
      enemies: {
        ...shiftEnemyTimers(state.enemies, frozenDuration),
        lastTickAt: timestamp,
      },
    };
  }
  const priorLiving = livingRats(state.enemies).length;
  const combatDelta =
    priorLiving > 0 && state.enemies.lastTickAt !== null
      ? Math.max(0, Math.min(1_000, timestamp - state.enemies.lastTickAt))
      : 0;
  let nextState: GameplayState = {
    ...state,
    enemies: {
      ...state.enemies,
      lastTickAt: timestamp,
      rats: state.enemies.rats.filter(
        (rat) =>
          rat.state !== 'corpse' || rat.corpseEndsAt === null || timestamp < rat.corpseEndsAt,
      ),
    },
    adaptation: {
      ...state.adaptation,
      signals: {
        ...state.adaptation.signals,
        combatTimeMs: state.adaptation.signals.combatTimeMs + combatDelta,
      },
    },
  };
  const occupied = new Set(livingRats(nextState.enemies).map((rat) => coordinateKey(rat.position)));
  const player = gridPositionToCoordinate(nextState.player.position);
  const ordered = [...nextState.enemies.rats].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const updated = new Map<string, RatEnemy>();
  for (const original of ordered) {
    let rat =
      original.hitFlashUntil !== null && timestamp >= original.hitFlashUntil
        ? { ...original, hitFlashUntil: null }
        : original;
    if (!isLivingRat(rat)) {
      updated.set(rat.id, rat);
      continue;
    }
    if (
      rat.state === 'telegraphing' &&
      rat.telegraphEndsAt !== null &&
      timestamp >= rat.telegraphEndsAt
    ) {
      const targetHit = rat.lockedTarget !== null && coordinatesMatch(rat.lockedTarget, player);
      const attackDirection = directionFromPlayerToRat(player, rat.position);
      const blocked =
        targetHit &&
        attackDirection !== null &&
        nextState.player.isShielding &&
        nextState.player.facing === attackDirection;
      let signals = nextState.adaptation.signals;
      signals = {
        ...signals,
        enemyAttacksLanded: signals.enemyAttacksLanded + (targetHit && !blocked ? 1 : 0),
        enemyAttacksMissed: signals.enemyAttacksMissed + (!targetHit ? 1 : 0),
        enemyAttacksBlocked: signals.enemyAttacksBlocked + (blocked ? 1 : 0),
      };
      nextState = {
        ...nextState,
        adaptation: { ...nextState.adaptation, signals },
        enemies: blocked ? { ...nextState.enemies, lastBlockAt: timestamp } : nextState.enemies,
        announcement: blocked
          ? 'Rat attack blocked.'
          : !targetHit
            ? 'Rat attack missed.'
            : nextState.announcement,
      };
      if (targetHit && !blocked) {
        nextState = applyPlayerDamage(nextState, {
          id: `rat-attack-${rat.id}-${timestamp}`,
          source: 'rat',
          amount: RAT_ATTACK_DAMAGE,
          timestamp,
        });
      }
      rat = {
        ...rat,
        state: 'cooldown',
        lockedTarget: null,
        telegraphEndsAt: null,
        cooldownEndsAt: timestamp + RAT_ATTACK_COOLDOWN_MS,
        nextMovementAt: null,
        nextPathStep: null,
      };
    } else if (
      rat.state === 'cooldown' &&
      rat.cooldownEndsAt !== null &&
      timestamp >= rat.cooldownEndsAt
    ) {
      rat = {
        ...rat,
        state: 'chasing',
        cooldownEndsAt: null,
        nextMovementAt: timestamp,
      };
    }
    if (nextState.status !== 'active') {
      updated.set(rat.id, rat);
      continue;
    }
    if (rat.state === 'chasing') {
      if (cardinalDistance(rat.position, player) === 1) {
        rat = {
          ...rat,
          state: 'telegraphing',
          lockedTarget: { ...player },
          telegraphEndsAt: timestamp + RAT_ATTACK_TELEGRAPH_MS,
          nextMovementAt: null,
          nextPathStep: null,
        };
        nextState = {
          ...nextState,
          adaptation: {
            ...nextState.adaptation,
            signals: {
              ...nextState.adaptation.signals,
              enemyAttacksStarted: nextState.adaptation.signals.enemyAttacksStarted + 1,
            },
          },
        };
      } else if (rat.nextMovementAt !== null && timestamp >= rat.nextMovementAt) {
        occupied.delete(coordinateKey(rat.position));
        const step = nextRatPathStep(action.room, rat, player, occupied);
        if (step && !coordinatesMatch(step, player) && !occupied.has(coordinateKey(step))) {
          rat = { ...rat, position: step, nextPathStep: step };
          occupied.add(coordinateKey(step));
        } else {
          occupied.add(coordinateKey(rat.position));
          rat = { ...rat, nextPathStep: step };
        }
        rat = { ...rat, nextMovementAt: timestamp + RAT_MOVEMENT_INTERVAL_MS };
      }
    }
    updated.set(rat.id, rat);
  }
  return {
    ...nextState,
    enemies: {
      ...nextState.enemies,
      rats: nextState.enemies.rats.map((rat) => updated.get(rat.id) ?? rat),
    },
  };
}

function completeRoomSignals(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'commit-room-transition' }>,
): AdaptiveRunState {
  const signals: PlayerBehaviorSignals = {
    ...state.adaptation.signals,
    roomTimesMs: [
      ...state.adaptation.signals.roomTimesMs,
      Math.max(0, action.exitedAtMs - (state.evaluationProgress?.roomEnteredAtMs ?? 0)),
    ],
    exitsChosenByDirection: {
      ...state.adaptation.signals.exitsChosenByDirection,
      [action.exitDirection ?? action.enteredFrom]:
        state.adaptation.signals.exitsChosenByDirection[
          action.exitDirection ?? action.enteredFrom
        ] + 1,
    },
  };
  const completedGeneratedRoom = Boolean(state.dungeonProgress?.currentRoom);
  const roomSignals = signals;
  const generatedRoomSignals: RoomBehaviorSnapshot[] = completedGeneratedRoom
    ? [
        ...state.adaptation.generatedRoomSignals,
        {
          roomNumber: state.dungeonProgress!.dungeonRoomNumber,
          signals: roomSignals,
        },
      ].slice(-5)
    : state.adaptation.generatedRoomSignals;
  const completedSummary = addSignalsToSummary(state.adaptation.completedSummary, roomSignals);
  const currentRunProfile = updateCurrentRunProfile(completedSummary, generatedRoomSignals);
  return {
    ...state.adaptation,
    signals: createBehaviorSignals(),
    completedSummary,
    generatedRoomSignals,
    currentRunProfile,
    effectiveProfile: action.effectiveProfile ?? currentRunProfile,
    shieldStartedAt: null,
    lastMeaningfulActionAt: null,
  };
}

export function gameplayReducer(state: GameplayState, action: GameplayAction): GameplayState {
  if (action.type === 'start-run') {
    const evaluationProgress =
      action.roomOrder && action.currentRoomId
        ? {
            roomOrder: [...action.roomOrder],
            currentRoomIndex: 0,
            currentRoomId: action.currentRoomId,
            enteredFrom: 'west' as const,
            roomEnteredAtMs: 0,
            exitChoices: [],
            evaluationComplete: false,
          }
        : null;
    const runSeed = action.runSeed ?? `${action.runId}-${action.startedAt}`;
    const enemies = action.enemies ?? emptyEnemyRoomState(action.currentRoomId);
    const adaptation = createAdaptiveRunState(action.longTermProfile);
    adaptation.signals.ratsSpawned = livingRats(enemies).length;
    return {
      ...createGameplayState(action.maximumHealth),
      status: 'active',
      player: createPlayer(action.spawn),
      runStats: { ...createRunStats(), runId: action.runId, startedAt: action.startedAt },
      experiencePreset: action.experiencePreset ?? 'seasoned-adventurer',
      evaluationProgress,
      dungeonProgress: {
        runSeed,
        dungeonRoomNumber: 0,
        currentRoom: null,
        enteredFrom: null,
        chosenExitIds: [],
        pokeCooldown: 0,
        previousMode: null,
      },
      adaptation,
      enemies,
    };
  }
  if (action.type === 'reset-to-idle') return createGameplayState(action.maximumHealth);
  if (action.type === 'reset-room') {
    if (state.status === 'defeated') return state;
    return {
      ...state,
      player: createPlayer(),
      invulnerability: { ...state.invulnerability, pendingRune: null },
      lastMove: null,
      blockedMove: null,
      lastAttack: null,
      lastDamage: null,
      lastAvoidedDamage: null,
      announcement: '',
    };
  }
  if (action.type === 'apply-debug-profile')
    return {
      ...state,
      adaptation: {
        ...state.adaptation,
        currentRunProfile: action.profile,
        effectiveProfile: action.profile,
      },
    };
  if (state.status !== 'active') return state;
  if (action.type === 'enemy-tick') return processEnemyTick(state, action);
  if (action.type === 'debug-freeze-enemy-ai')
    return { ...state, enemies: { ...state.enemies, aiFrozen: action.frozen } };
  if (action.type === 'shift-enemy-timers')
    return action.duration <= 0
      ? state
      : { ...state, enemies: shiftEnemyTimers(state.enemies, action.duration) };
  if (action.type === 'debug-spawn-rat') {
    const occupied = new Set([
      ...livingRats(state.enemies).map((rat) => coordinateKey(rat.position)),
      coordinateKey(gridPositionToCoordinate(state.player.position)),
      ...(action.room.hazards ?? []).map(coordinateKey),
      ...action.room.exits.map((exit) => coordinateKey(exit.tile)),
    ]);
    const tile = [...action.room.floorTiles]
      .sort((left, right) => left.y - right.y || left.x - right.x)
      .find((candidate) => !occupied.has(coordinateKey(candidate)));
    if (!tile) return { ...state, announcement: 'No safe tile is available for a debug Rat.' };
    const spawn = {
      id: `${action.room.id}-debug-rat-${state.enemies.rats.length + 1}`,
      type: 'rat' as const,
      tile,
      order: state.enemies.rats.length + 1,
      source: 'generated' as const,
      reason: 'Development Debug Tools spawn',
    };
    return {
      ...state,
      enemies: {
        ...state.enemies,
        rats: [...state.enemies.rats, createRatFromSpawn(spawn, action.timestamp, 'debug')],
      },
      adaptation: {
        ...state.adaptation,
        signals: {
          ...state.adaptation.signals,
          ratsSpawned: state.adaptation.signals.ratsSpawned + 1,
        },
      },
      announcement: 'Debug Rat spawned.',
    };
  }
  if (action.type === 'debug-defeat-all-enemies') {
    let defeated = 0;
    const rats = state.enemies.rats.map((rat) => {
      if (!isLivingRat(rat)) return rat;
      defeated += rat.defeatCounted ? 0 : 1;
      return defeatRat(rat, action.timestamp);
    });
    return {
      ...state,
      enemies: { ...state.enemies, rats },
      runStats: {
        ...state.runStats,
        enemiesDefeated: state.runStats.enemiesDefeated + defeated,
      },
      adaptation: {
        ...state.adaptation,
        signals: {
          ...state.adaptation.signals,
          ratsDefeated: state.adaptation.signals.ratsDefeated + defeated,
        },
      },
      announcement: defeated ? 'All Rats defeated through Debug Tools.' : 'No living Rats remain.',
    };
  }
  if (action.type === 'pause-run') {
    if (state.pause.isPaused) return state;
    const timestamp = Math.max(0, action.timestamp);
    const shieldDuration =
      state.player.isShielding && state.adaptation.shieldStartedAt !== null
        ? Math.max(0, timestamp - state.adaptation.shieldStartedAt)
        : 0;
    return {
      ...state,
      player: { ...state.player, isShielding: false, shieldDirection: null },
      pause: {
        isPaused: true,
        reason: action.reason,
        pausedAt: timestamp,
        totalPausedMs: state.pause.totalPausedMs,
      },
      adaptation: {
        ...state.adaptation,
        shieldStartedAt: null,
        signals: {
          ...state.adaptation.signals,
          shieldTimeMs: state.adaptation.signals.shieldTimeMs + shieldDuration,
        },
      },
      announcement: 'Run paused.',
    };
  }
  if (action.type === 'resume-run') {
    if (!state.pause.isPaused) return state;
    const pausedDuration = Math.max(0, action.timestamp - state.pause.pausedAt);
    return {
      ...state,
      pause: {
        isPaused: false,
        totalPausedMs: state.pause.totalPausedMs + pausedDuration,
      },
      invulnerability: {
        ...state.invulnerability,
        expiresAt:
          state.invulnerability.expiresAt === null
            ? null
            : state.invulnerability.expiresAt + pausedDuration,
      },
      attackCooldown: {
        readyAt:
          state.attackCooldown.readyAt === null
            ? null
            : state.attackCooldown.readyAt + pausedDuration,
      },
      enemies: shiftEnemyTimers(state.enemies, pausedDuration),
      adaptation: {
        ...state.adaptation,
        lastMeaningfulActionAt:
          state.adaptation.lastMeaningfulActionAt === null
            ? null
            : state.adaptation.lastMeaningfulActionAt + pausedDuration,
      },
      announcement: 'Run resumed.',
    };
  }
  if (state.pause.isPaused) return state;
  if (action.type === 'shield') {
    if (state.player.isShielding === action.isShielding) return state;
    const timestamp = action.timestamp ?? Date.now();
    const duration =
      !action.isShielding && state.adaptation.shieldStartedAt !== null
        ? Math.max(0, timestamp - state.adaptation.shieldStartedAt)
        : 0;
    const adaptation = withMeaningfulAction(state.adaptation, timestamp);
    return {
      ...state,
      player: {
        ...state.player,
        isShielding: action.isShielding,
        shieldDirection: action.isShielding ? state.player.facing : null,
      },
      adaptation: {
        ...adaptation,
        shieldStartedAt: action.isShielding ? timestamp : null,
        signals: {
          ...adaptation.signals,
          shieldActivations: adaptation.signals.shieldActivations + (action.isShielding ? 1 : 0),
          shieldTimeMs: adaptation.signals.shieldTimeMs + duration,
        },
      },
      announcement: action.isShielding ? 'Shield raised.' : 'Shield lowered.',
    };
  }
  if (action.type === 'attack') {
    if (state.attackCooldown.readyAt !== null && action.timestamp < state.attackCooldown.readyAt)
      return state;
    const attack = createAttackAction(
      state.player,
      getCollisionContext(action.room),
      action.id,
      action.timestamp,
    );
    const adaptation = withMeaningfulAction(state.adaptation, action.timestamp);
    const ratResult = applySwordToRats(state, attack, action.timestamp);
    return {
      ...state,
      adaptation: {
        ...adaptation,
        signals: {
          ...adaptation.signals,
          swordSwings: adaptation.signals.swordSwings + 1,
          swordSwingsAtEnemies: adaptation.signals.swordSwingsAtEnemies + (ratResult.hit ? 1 : 0),
          ratsDamaged: adaptation.signals.ratsDamaged + ratResult.damaged,
          ratsDefeated: adaptation.signals.ratsDefeated + ratResult.defeated,
        },
      },
      enemies: ratResult.enemies,
      runStats: {
        ...state.runStats,
        enemiesDefeated: state.runStats.enemiesDefeated + ratResult.defeated,
      },
      lastAttack: attack,
      attackCooldown: { readyAt: action.timestamp + ATTACK_COOLDOWN_MS },
      announcement: attack.target
        ? ratResult.defeated
          ? 'Rat defeated.'
          : ratResult.hit
            ? 'Rat injured.'
            : `Attacked ${attack.facing}.`
        : 'Attacked beyond the room boundary.',
    };
  }
  if (action.type === 'turn') {
    if (state.player.facing === action.direction) return state;
    const adaptation =
      action.trigger === 'repeat'
        ? state.adaptation
        : withMeaningfulAction(state.adaptation, action.timestamp ?? Date.now());
    return {
      ...state,
      adaptation: {
        ...adaptation,
        signals: {
          ...adaptation.signals,
          directionChanges:
            adaptation.signals.directionChanges + (action.trigger === 'repeat' ? 0 : 1),
        },
      },
      player: turnPlayer(state.player, action.direction),
      announcement: `Facing ${action.direction}.`,
    };
  }
  if (action.type === 'move') return movePlayer(state, action);
  if (
    action.type === 'commit-room-transition' &&
    state.evaluationProgress &&
    state.dungeonProgress
  ) {
    const dungeonRoomsCleared =
      state.runStats.dungeonRoomsCleared + (action.incrementDungeonRooms ? 1 : 0);
    const adaptation = completeRoomSignals(state, action);
    const enemies = action.enemies ?? emptyEnemyRoomState(action.destinationRoomId);
    adaptation.signals.ratsSpawned = livingRats(enemies).length;
    return {
      ...state,
      player: {
        ...state.player,
        position: action.destinationSpawn,
        isShielding: false,
        shieldDirection: null,
      },
      invulnerability: createInvulnerabilityState(),
      runStats: { ...state.runStats, dungeonRoomsCleared, roomsCleared: dungeonRoomsCleared },
      evaluationProgress: {
        ...state.evaluationProgress,
        currentRoomId: action.destinationRoomId,
        currentRoomIndex: action.destinationRoomIndex,
        enteredFrom: action.enteredFrom,
        roomEnteredAtMs: action.exitedAtMs,
        exitChoices: action.exitChoice
          ? [...state.evaluationProgress.exitChoices, action.exitChoice]
          : state.evaluationProgress.exitChoices,
        evaluationComplete: action.evaluationComplete,
      },
      dungeonProgress: {
        ...state.dungeonProgress,
        dungeonRoomNumber:
          action.generatedRoom?.dungeonRoomNumber ?? state.dungeonProgress.dungeonRoomNumber,
        currentRoom: action.generatedRoom ?? state.dungeonProgress.currentRoom,
        enteredFrom: action.generatedRoom ? action.enteredFrom : state.dungeonProgress.enteredFrom,
        chosenExitIds: action.chosenExitId
          ? [...state.dungeonProgress.chosenExitIds, action.chosenExitId].slice(-5)
          : state.dungeonProgress.chosenExitIds,
        pokeCooldown: action.nextPokeCooldown ?? state.dungeonProgress.pokeCooldown,
        previousMode: action.nextMode ?? state.dungeonProgress.previousMode,
      },
      adaptation,
      enemies,
      lastMove: null,
      blockedMove: null,
      lastAttack: null,
      lastDamage: null,
      lastAvoidedDamage: null,
      announcement: action.generatedRoom
        ? `Entered Dungeon Room ${action.generatedRoom.dungeonRoomNumber}.`
        : 'Entered the next Awakening Chamber.',
    };
  }
  if (
    action.type === 'invulnerability-expired' &&
    state.runStats.runId === action.runId &&
    state.invulnerability.expiresAt === action.expectedExpiresAt &&
    action.timestamp >= action.expectedExpiresAt
  ) {
    const pendingRune = state.invulnerability.pendingRune;
    const expiredState = { ...state, invulnerability: createInvulnerabilityState() };
    return pendingRune && positionsMatch(state.player.position, pendingRune)
      ? applyPlayerDamage(expiredState, {
          id: `delayed-rune-${action.expectedExpiresAt}`,
          source: 'rune',
          amount: 1,
          timestamp: action.expectedExpiresAt,
        })
      : expiredState;
  }
  return state;
}

export interface RestorableGameplayRun {
  status: Exclude<GameplayStatus, 'idle'>;
  runId: string;
  elapsedMs: number;
  currentHealth: number;
  player: Pick<PlayerState, 'position' | 'facing'>;
  dungeonRoomsCleared: number;
  roomsCleared?: number;
  enemiesDefeated: number;
  evaluationProgress: EvaluationProgress;
  dungeonProgress: DungeonProgress;
  experiencePreset: ExperiencePreset;
  adaptation: AdaptiveRunState;
  enemies: StoredEnemyRoomState;
  pause: RunPauseState;
  invulnerabilityRemainingMs: number;
  pendingRune: GridPosition | null;
  attackCooldownRemainingMs: number;
}

export function restoreGameplayState(
  snapshot: RestorableGameplayRun,
  maximumHealth: number,
  now: number,
): GameplayState {
  const base = createGameplayState(maximumHealth);
  const elapsedMs = Math.max(0, Math.trunc(snapshot.elapsedMs));
  const dungeonRoomsCleared = Math.max(
    0,
    Math.trunc(snapshot.dungeonRoomsCleared ?? snapshot.roomsCleared ?? 0),
  );
  const enemies: EnemyRoomState = {
    roomId: snapshot.enemies.roomId,
    aiFrozen: snapshot.enemies.aiFrozen,
    countPlan: snapshot.enemies.countPlan,
    lastBlockAt:
      snapshot.enemies.lastBlockRemainingMs > 0
        ? now + snapshot.enemies.lastBlockRemainingMs
        : null,
    lastTickAt: now,
    rats: snapshot.enemies.rats.map((rat) => ({
      id: rat.id,
      type: rat.type,
      position: rat.position,
      health: rat.health,
      state: rat.state,
      lockedTarget: rat.lockedTarget,
      nextMovementAt: rat.movementRemainingMs > 0 ? now + rat.movementRemainingMs : null,
      telegraphEndsAt: rat.telegraphRemainingMs > 0 ? now + rat.telegraphRemainingMs : null,
      cooldownEndsAt: rat.cooldownRemainingMs > 0 ? now + rat.cooldownRemainingMs : null,
      corpseEndsAt: rat.corpseRemainingMs > 0 ? now + rat.corpseRemainingMs : null,
      hitFlashUntil: rat.hitFlashRemainingMs > 0 ? now + rat.hitFlashRemainingMs : null,
      defeatCounted: rat.defeatCounted,
      spawnSource: rat.spawnSource,
      spawnReason: rat.spawnReason,
      authoredSpawnNumber: rat.authoredSpawnNumber,
      nextPathStep: rat.nextPathStep,
    })),
  };
  return {
    ...base,
    status: snapshot.status,
    player: { ...base.player, position: snapshot.player.position, facing: snapshot.player.facing },
    currentHealth: clampHealth(snapshot.currentHealth, base.maximumHealth),
    pause: snapshot.pause.isPaused
      ? {
          isPaused: true,
          reason: snapshot.pause.reason,
          pausedAt: now,
          totalPausedMs: snapshot.pause.totalPausedMs,
        }
      : {
          isPaused: false,
          totalPausedMs: snapshot.pause.totalPausedMs,
        },
    invulnerability: {
      expiresAt:
        snapshot.invulnerabilityRemainingMs > 0 ? now + snapshot.invulnerabilityRemainingMs : null,
      pendingRune: snapshot.invulnerabilityRemainingMs > 0 ? snapshot.pendingRune : null,
    },
    attackCooldown: {
      readyAt:
        snapshot.attackCooldownRemainingMs > 0 ? now + snapshot.attackCooldownRemainingMs : null,
    },
    runStats: {
      runId: snapshot.runId,
      startedAt: now - elapsedMs - snapshot.pause.totalPausedMs,
      timeSurvived: snapshot.status === 'defeated' ? elapsedMs : null,
      dungeonRoomsCleared,
      roomsCleared: dungeonRoomsCleared,
      enemiesDefeated: Math.max(0, Math.trunc(snapshot.enemiesDefeated)),
    },
    experiencePreset: snapshot.experiencePreset,
    evaluationProgress: snapshot.evaluationProgress,
    dungeonProgress: snapshot.dungeonProgress,
    adaptation: snapshot.adaptation,
    enemies,
    announcement: snapshot.status === 'defeated' ? 'You were defeated.' : '',
  };
}

export function getTimeSurvived(
  runStats: RunStats,
  now: number,
  pause: RunPauseState = createPauseState(),
): number {
  if (runStats.timeSurvived !== null) return runStats.timeSurvived;
  if (runStats.startedAt === null) return 0;
  const currentPauseMs = pause.isPaused ? Math.max(0, now - pause.pausedAt) : 0;
  return Math.max(0, now - runStats.startedAt - pause.totalPausedMs - currentPauseMs);
}
export function formatSurvivalTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export { createBehaviorSignals };
