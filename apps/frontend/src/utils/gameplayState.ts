import { CURRENT_ROOM_LAYOUT, isHazardPosition } from '../data/roomLayout';
import type {
  AdaptiveProfile,
  AdaptiveRunState,
  ExperiencePreset,
  PlayerBehaviorSignals,
  RoomBehaviorSnapshot,
} from '../types/adaptation';
import type { DungeonProgress, GeneratedRoomSave } from '../types/generation';
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
  createBehaviorSignals,
  subtractSignals,
  updateCurrentRunProfile,
} from './adaptiveProfile';
import {
  coordinateToGridPosition,
  gridPositionToCoordinate,
  isWalkableCoordinate,
  roomBounds,
} from './roomGeometry';
import { attemptMove, createAttackAction, positionsMatch, turnPlayer } from './playerActions';

export const INVULNERABILITY_DURATION_MS = 500;
const IDLE_THRESHOLD_MS = 1_000;

export type GameplayStatus = 'idle' | 'active' | 'defeated';
export type DamageSource = 'rune';

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
  runStats: RunStats;
  experiencePreset: ExperiencePreset | null;
  evaluationProgress: EvaluationProgress | null;
  dungeonProgress: DungeonProgress | null;
  adaptation: AdaptiveRunState;
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
    }
  | { type: 'reset-room' }
  | { type: 'reset-to-idle'; maximumHealth: number }
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
    }
  | { type: 'apply-debug-profile'; profile: AdaptiveProfile }
  | {
      type: 'invulnerability-expired';
      runId: string;
      expectedExpiresAt: number;
      timestamp: number;
    };

const legacyCollisionContext = { bounds: CURRENT_ROOM_LAYOUT.bounds, isBlocked: () => false };
function getCollisionContext(room?: RoomDefinition) {
  return room
    ? {
        bounds: roomBounds(room),
        isBlocked: (position: GridPosition) =>
          !isWalkableCoordinate(room, gridPositionToCoordinate(position)),
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
    runStats: createRunStats(),
    experiencePreset: null,
    evaluationProgress: null,
    dungeonProgress: null,
    adaptation: createAdaptiveRunState(),
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
  const timeSurvived =
    fatal && state.runStats.startedAt !== null
      ? Math.max(0, event.timestamp - state.runStats.startedAt)
      : state.runStats.timeSurvived;
  return {
    ...state,
    status: fatal ? 'defeated' : 'active',
    player: fatal ? { ...state.player, isShielding: false, shieldDirection: null } : state.player,
    currentHealth,
    invulnerability: fatal
      ? createInvulnerabilityState()
      : { expiresAt: event.timestamp + INVULNERABILITY_DURATION_MS, pendingRune: null },
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
      : `Rune damaged you. ${currentHealth} of ${state.maximumHealth} health remaining.`,
  };
}

function movePlayer(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'move' }>,
): GameplayState {
  const movement = attemptMove(
    state.player,
    action.direction,
    getCollisionContext(action.room),
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
  const roomSignals = subtractSignals(signals, state.adaptation.currentRoomSignalBaseline);
  const generatedRoomSignals: RoomBehaviorSnapshot[] = completedGeneratedRoom
    ? [
        ...state.adaptation.generatedRoomSignals,
        { roomNumber: state.dungeonProgress!.dungeonRoomNumber, signals: roomSignals },
      ]
    : state.adaptation.generatedRoomSignals;
  const currentRunProfile = updateCurrentRunProfile(signals, generatedRoomSignals);
  return {
    ...state.adaptation,
    signals,
    generatedRoomSignals,
    currentRunProfile,
    effectiveProfile: action.effectiveProfile ?? currentRunProfile,
    shieldStartedAt: null,
    lastMeaningfulActionAt: null,
    currentRoomSignalBaseline: signals,
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
      adaptation: createAdaptiveRunState(action.longTermProfile),
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
    const attack = createAttackAction(
      state.player,
      getCollisionContext(action.room),
      action.id,
      action.timestamp,
    );
    const adaptation = withMeaningfulAction(state.adaptation, action.timestamp);
    return {
      ...state,
      adaptation: {
        ...adaptation,
        signals: { ...adaptation.signals, swordSwings: adaptation.signals.swordSwings + 1 },
      },
      lastAttack: attack,
      announcement: attack.target
        ? `Attacked ${attack.facing}.`
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
          ? [...state.dungeonProgress.chosenExitIds, action.chosenExitId]
          : state.dungeonProgress.chosenExitIds,
        pokeCooldown: action.nextPokeCooldown ?? state.dungeonProgress.pokeCooldown,
        previousMode: action.nextMode ?? state.dungeonProgress.previousMode,
      },
      adaptation,
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
  return {
    ...base,
    status: snapshot.status,
    player: { ...base.player, position: snapshot.player.position, facing: snapshot.player.facing },
    currentHealth: clampHealth(snapshot.currentHealth, base.maximumHealth),
    runStats: {
      runId: snapshot.runId,
      startedAt: now - elapsedMs,
      timeSurvived: snapshot.status === 'defeated' ? elapsedMs : null,
      dungeonRoomsCleared,
      roomsCleared: dungeonRoomsCleared,
      enemiesDefeated: Math.max(0, Math.trunc(snapshot.enemiesDefeated)),
    },
    experiencePreset: snapshot.experiencePreset,
    evaluationProgress: snapshot.evaluationProgress,
    dungeonProgress: snapshot.dungeonProgress,
    adaptation: snapshot.adaptation,
    announcement: snapshot.status === 'defeated' ? 'You were defeated.' : '',
  };
}

export function getTimeSurvived(runStats: RunStats, now: number): number {
  if (runStats.timeSurvived !== null) return runStats.timeSurvived;
  if (runStats.startedAt === null) return 0;
  return Math.max(0, now - runStats.startedAt);
}
export function formatSurvivalTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export { createBehaviorSignals };
