import { describe, expect, expectTypeOf, it } from 'vitest';
import { RAT_COMBAT_CONFIG, type RatCombatConfig } from './combat';

describe('Resonant Ruins Rat combat configuration', () => {
  it('centralizes the approved v0.2 timing and awareness values', () => {
    expect(RAT_COMBAT_CONFIG).toMatchObject({
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
    });
  });

  it('exports a readonly inferred configuration type', () => {
    expectTypeOf(RAT_COMBAT_CONFIG).toEqualTypeOf<RatCombatConfig>();
  });
});
