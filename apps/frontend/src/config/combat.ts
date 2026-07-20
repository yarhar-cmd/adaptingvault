export const RAT_COMBAT_CONFIG = {
  movementIntervalMs: 333,
  telegraphMs: 425,
  lungeMs: 100,
  recoveryMs: 300,
  perfectBlockRecoveryMs: 500,
  perfectBlockWindowMs: 125,
  roomEntryAwarenessGraceMs: 500,
  awarenessRangeTiles: 7,
  alertPropagationRangeTiles: 3,
  minimumSpawnPathDistanceTiles: 4,
  corpseAbsorptionMs: 700,
  hitFlashMs: 140,
  shieldBlockFlashMs: 180,
  playerDamageInvulnerabilityMs: 500,
} as const;

export type RatCombatConfig = typeof RAT_COMBAT_CONFIG;
