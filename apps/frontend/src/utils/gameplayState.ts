import { CURRENT_ROOM_LAYOUT, isHazardPosition } from '../data/roomLayout';
import type {
  AttackAction,
  CardinalDirection,
  GridPosition,
  MoveResult,
  MoveTrigger,
  PlayerState,
} from '../types/player';
import { attemptMove, createAttackAction, positionsMatch, turnPlayer } from './playerActions';

export const INVULNERABILITY_DURATION_MS = 500;

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
  lastMove: MoveResult | null;
  blockedMove: MoveResult | null;
  lastAttack: AttackAction | null;
  lastDamage: DamageEvent | null;
  lastAvoidedDamage: AvoidedDamageEvent | null;
  announcement: string;
}

export type GameplayAction =
  | { type: 'start-run'; maximumHealth: number; startedAt: number; runId: string }
  | { type: 'reset-room' }
  | { type: 'reset-to-idle'; maximumHealth: number }
  | {
      type: 'move';
      direction: CardinalDirection;
      trigger: MoveTrigger;
      id: string;
      timestamp: number;
      hazards: readonly GridPosition[];
    }
  | { type: 'turn'; direction: CardinalDirection; trigger: MoveTrigger }
  | { type: 'attack'; id: string; timestamp: number }
  | { type: 'shield'; isShielding: boolean }
  | {
      type: 'invulnerability-expired';
      runId: string;
      expectedExpiresAt: number;
      timestamp: number;
    };

const collisionContext = {
  bounds: CURRENT_ROOM_LAYOUT.bounds,
  isBlocked: () => false,
};

function createPlayer(): PlayerState {
  return {
    position: { row: 2, column: 0 },
    facing: 'right',
    isShielding: false,
    shieldDirection: null,
  };
}

function createRunStats(): RunStats {
  return {
    runId: null,
    startedAt: null,
    timeSurvived: null,
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
    lastMove: null,
    blockedMove: null,
    lastAttack: null,
    lastDamage: null,
    lastAvoidedDamage: null,
    announcement: '',
  };
}

export function applyPlayerDamage(
  state: GameplayState,
  event: Omit<DamageEvent, 'fatal'>,
): GameplayState {
  if (state.status !== 'active' || event.amount <= 0) return state;
  if (
    state.invulnerability.expiresAt !== null &&
    event.timestamp < state.invulnerability.expiresAt
  ) {
    return state;
  }

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
  const movement = attemptMove(state.player, action.direction, collisionContext, action.id);
  const shouldShowBlockedFeedback =
    movement.result.blockedReason !== null &&
    (action.trigger !== 'repeat' ||
      state.lastMove?.blockedReason === null ||
      state.lastMove?.facing !== movement.result.facing);
  const shouldAnnounce = action.trigger !== 'repeat' || shouldShowBlockedFeedback;
  const movementAnnouncement = movement.result.moved
    ? `Moved ${movement.result.facing}.`
    : `Blocked moving ${movement.result.facing}.`;
  const invulnerabilityActive =
    state.invulnerability.expiresAt !== null && action.timestamp < state.invulnerability.expiresAt;

  let nextState: GameplayState = {
    ...state,
    player: movement.player,
    invulnerability: invulnerabilityActive ? state.invulnerability : createInvulnerabilityState(),
    lastMove: movement.result,
    blockedMove: shouldShowBlockedFeedback ? movement.result : state.blockedMove,
    announcement: shouldAnnounce ? movementAnnouncement : state.announcement,
  };

  if (!movement.result.moved) return nextState;

  if (!isHazardPosition(movement.result.target, action.hazards)) {
    if (nextState.invulnerability.pendingRune !== null) {
      nextState = {
        ...nextState,
        invulnerability: { ...nextState.invulnerability, pendingRune: null },
      };
    }
    return nextState;
  }

  if (invulnerabilityActive) {
    return {
      ...nextState,
      invulnerability: {
        ...nextState.invulnerability,
        pendingRune: movement.result.target,
      },
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

export function gameplayReducer(state: GameplayState, action: GameplayAction): GameplayState {
  if (action.type === 'start-run') {
    return {
      ...createGameplayState(action.maximumHealth),
      status: 'active',
      runStats: {
        runId: action.runId,
        startedAt: action.startedAt,
        timeSurvived: null,
        roomsCleared: 0,
        enemiesDefeated: 0,
      },
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

  if (state.status !== 'active') return state;

  if (action.type === 'shield') {
    if (state.player.isShielding === action.isShielding) return state;
    return {
      ...state,
      player: {
        ...state.player,
        isShielding: action.isShielding,
        shieldDirection: action.isShielding ? state.player.facing : null,
      },
      announcement: action.isShielding ? 'Shield raised.' : 'Shield lowered.',
    };
  }

  if (action.type === 'attack') {
    const attack = createAttackAction(state.player, collisionContext, action.id, action.timestamp);
    return {
      ...state,
      lastAttack: attack,
      announcement: attack.target
        ? `Attacked ${attack.facing}.`
        : 'Attacked beyond the room boundary.',
    };
  }

  if (action.type === 'turn') {
    if (state.player.facing === action.direction) return state;
    return {
      ...state,
      player: turnPlayer(state.player, action.direction),
      announcement: `Facing ${action.direction}.`,
    };
  }

  if (action.type === 'move') return movePlayer(state, action);

  if (
    action.type === 'invulnerability-expired' &&
    state.runStats.runId === action.runId &&
    state.invulnerability.expiresAt === action.expectedExpiresAt &&
    action.timestamp >= action.expectedExpiresAt
  ) {
    const pendingRune = state.invulnerability.pendingRune;
    const expiredState = { ...state, invulnerability: createInvulnerabilityState() };

    if (pendingRune && positionsMatch(state.player.position, pendingRune)) {
      return applyPlayerDamage(expiredState, {
        id: `delayed-rune-${action.expectedExpiresAt}`,
        source: 'rune',
        amount: 1,
        timestamp: action.expectedExpiresAt,
      });
    }

    return expiredState;
  }

  return state;
}

export function getTimeSurvived(runStats: RunStats, now: number): number {
  if (runStats.timeSurvived !== null) return runStats.timeSurvived;
  if (runStats.startedAt === null) return 0;
  return Math.max(0, now - runStats.startedAt);
}

export function formatSurvivalTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
