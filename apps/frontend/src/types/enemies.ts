import type { TileCoordinate } from './rooms';

export const RAT_MOVEMENT_INTERVAL_MS = 333;
export const RAT_ATTACK_TELEGRAPH_MS = 300;
export const RAT_ATTACK_COOLDOWN_MS = 1_200;
export const RAT_MAX_HEALTH = 2;
export const RAT_ATTACK_DAMAGE = 1;
export const RAT_CORPSE_ABSORPTION_MS = 700;
export const PLAYER_DAMAGE_INVULNERABILITY_MS = 500;

export type EnemyType = 'rat';
export type RatState = 'chasing' | 'telegraphing' | 'cooldown' | 'corpse';
export type EnemySpawnSource = 'authored' | 'generated' | 'debug' | 'preview';

export interface RatEnemy {
  id: string;
  type: 'rat';
  position: TileCoordinate;
  health: number;
  state: RatState;
  lockedTarget: TileCoordinate | null;
  nextMovementAt: number | null;
  telegraphEndsAt: number | null;
  cooldownEndsAt: number | null;
  corpseEndsAt: number | null;
  hitFlashUntil: number | null;
  defeatCounted: boolean;
  spawnSource: EnemySpawnSource;
  spawnReason: string;
  authoredSpawnNumber?: number;
  nextPathStep: TileCoordinate | null;
}

export interface EnemyRoomState {
  roomId: string;
  rats: RatEnemy[];
  aiFrozen: boolean;
  countPlan: EnemyCountPlan | null;
  lastBlockAt: number | null;
  lastTickAt: number | null;
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
  'nextMovementAt' | 'telegraphEndsAt' | 'cooldownEndsAt' | 'corpseEndsAt' | 'hitFlashUntil'
> {
  movementRemainingMs: number;
  telegraphRemainingMs: number;
  cooldownRemainingMs: number;
  corpseRemainingMs: number;
  hitFlashRemainingMs: number;
}

export interface StoredEnemyRoomState extends Omit<
  EnemyRoomState,
  'rats' | 'lastBlockAt' | 'lastTickAt'
> {
  rats: StoredRatEnemy[];
  lastBlockRemainingMs: number;
}
