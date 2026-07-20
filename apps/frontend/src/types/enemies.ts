import { RAT_COMBAT_CONFIG } from '../config/combat';
import type { CardinalDirection } from './player';
import type { TileCoordinate } from './rooms';

export const RAT_MOVEMENT_INTERVAL_MS = RAT_COMBAT_CONFIG.movementIntervalMs;
export const RAT_ATTACK_TELEGRAPH_MS = RAT_COMBAT_CONFIG.telegraphMs;
export const RAT_ATTACK_LUNGE_MS = RAT_COMBAT_CONFIG.lungeMs;
export const RAT_ATTACK_RECOVERY_MS = RAT_COMBAT_CONFIG.recoveryMs;
export const RAT_PERFECT_BLOCK_RECOVERY_MS = RAT_COMBAT_CONFIG.perfectBlockRecoveryMs;
/** @deprecated Use RAT_ATTACK_RECOVERY_MS. */
export const RAT_ATTACK_COOLDOWN_MS = RAT_ATTACK_RECOVERY_MS;
export const RAT_MAX_HEALTH = 2;
export const RAT_ATTACK_DAMAGE = 1;
export const RAT_CORPSE_ABSORPTION_MS = RAT_COMBAT_CONFIG.corpseAbsorptionMs;
export const PLAYER_DAMAGE_INVULNERABILITY_MS = RAT_COMBAT_CONFIG.playerDamageInvulnerabilityMs;

export type EnemyType = 'rat';
export type RatState = 'idle' | 'chasing' | 'telegraphing' | 'lunging' | 'recovering' | 'corpse';
export type RatAwareness = 'unaware' | 'alerted';
export type RatRecoveryKind = 'standard' | 'perfect-block';
export type RatAttackOutcome = 'hit' | 'miss' | 'block' | 'perfect-block';
export type EnemySpawnSource = 'authored' | 'generated' | 'debug' | 'preview';

export interface CombatMetrics {
  attacksStarted: number;
  attacksLanded: number;
  attacksDodged: number;
  regularBlocks: number;
  perfectBlocks: number;
  attacksCancelledByDefeat: number;
  swordSwings: number;
  playerHitsLanded: number;
  playerDamageTaken: number;
  combatDurationMs: number;
  maximumSimultaneouslyAlertedRats: number;
  bodyLockPreventionActivations: number;
}

export function createCombatMetrics(): CombatMetrics {
  return {
    attacksStarted: 0,
    attacksLanded: 0,
    attacksDodged: 0,
    regularBlocks: 0,
    perfectBlocks: 0,
    attacksCancelledByDefeat: 0,
    swordSwings: 0,
    playerHitsLanded: 0,
    playerDamageTaken: 0,
    combatDurationMs: 0,
    maximumSimultaneouslyAlertedRats: 0,
    bodyLockPreventionActivations: 0,
  };
}

export interface RatEnemy {
  id: string;
  type: 'rat';
  position: TileCoordinate;
  facing: CardinalDirection;
  awareness: RatAwareness;
  health: number;
  state: RatState;
  lockedTarget: TileCoordinate | null;
  nextMovementAt: number | null;
  telegraphEndsAt: number | null;
  lungeEndsAt: number | null;
  recoveryEndsAt: number | null;
  recoveryKind: RatRecoveryKind | null;
  attackOutcome: RatAttackOutcome | null;
  corpseEndsAt: number | null;
  hitFlashUntil: number | null;
  defeatCounted: boolean;
  spawnSource: EnemySpawnSource;
  spawnReason: string;
  authoredSpawnNumber?: number;
  nextPathStep: TileCoordinate | null;
  pathDistanceToPlayer: number | null;
  pathBlocked: boolean;
}

export interface EnemyRoomState {
  roomId: string;
  rats: RatEnemy[];
  aiFrozen: boolean;
  countPlan: EnemyCountPlan | null;
  lastBlockAt: number | null;
  lastBlockKind: 'regular' | 'perfect' | null;
  lastTickAt: number | null;
  awarenessGraceEndsAt: number | null;
  combatMetrics: CombatMetrics;
}

export interface EnemyCountPlan {
  cap: number;
  basePressure: number;
  roomSizeAdjustment: number;
  shapeAdjustment: number;
  hazardAdjustment: number;
  adaptationAdjustment: number;
  presetAdjustment: number;
  requestedCount: number;
  selectedCount: number;
}

export interface StoredRatEnemy extends Omit<
  RatEnemy,
  | 'nextMovementAt'
  | 'telegraphEndsAt'
  | 'lungeEndsAt'
  | 'recoveryEndsAt'
  | 'corpseEndsAt'
  | 'hitFlashUntil'
> {
  movementRemainingMs: number;
  telegraphRemainingMs: number;
  lungeRemainingMs: number;
  recoveryRemainingMs: number;
  corpseRemainingMs: number;
  hitFlashRemainingMs: number;
}

export interface StoredEnemyRoomState extends Omit<
  EnemyRoomState,
  'rats' | 'lastBlockAt' | 'lastTickAt' | 'awarenessGraceEndsAt'
> {
  rats: StoredRatEnemy[];
  lastBlockRemainingMs: number;
  awarenessGraceRemainingMs: number;
}
