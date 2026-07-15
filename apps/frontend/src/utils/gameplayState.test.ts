import { describe, expect, it } from 'vitest';
import { CURRENT_ROOM_LAYOUT } from '../data/roomLayout';
import type { CardinalDirection, GridPosition } from '../types/player';
import {
  INVULNERABILITY_DURATION_MS,
  applyPlayerDamage,
  createGameplayState,
  formatSurvivalTime,
  gameplayReducer,
  getTimeSurvived,
  type GameplayState,
} from './gameplayState';

function startRun(maximumHealth = 6, startedAt = 1_000): GameplayState {
  return gameplayReducer(createGameplayState(maximumHealth), {
    type: 'start-run',
    maximumHealth,
    startedAt,
    runId: 'run-1',
  });
}

function atPosition(state: GameplayState, position: GridPosition): GameplayState {
  return { ...state, player: { ...state.player, position } };
}

function move(
  state: GameplayState,
  direction: CardinalDirection,
  timestamp: number,
  hazards = CURRENT_ROOM_LAYOUT.hazards,
): GameplayState {
  return gameplayReducer(state, {
    type: 'move',
    direction,
    trigger: 'press',
    id: `move-${timestamp}`,
    timestamp,
    hazards,
  });
}

function expire(state: GameplayState, timestamp: number): GameplayState {
  const expectedExpiresAt = state.invulnerability.expiresAt;
  if (expectedExpiresAt === null) throw new Error('Expected active invulnerability');
  return gameplayReducer(state, {
    type: 'invulnerability-expired',
    runId: state.runStats.runId!,
    expectedExpiresAt,
    timestamp,
  });
}

describe('Resonant Ruins gameplay state', () => {
  it('initializes a Warden run with one authoritative six-point health pool', () => {
    const state = startRun();

    expect(state).toMatchObject({
      status: 'active',
      currentHealth: 6,
      maximumHealth: 6,
      runStats: {
        startedAt: 1_000,
        timeSurvived: null,
        roomsCleared: 0,
        enemiesDefeated: 0,
      },
    });
  });

  it('deals one damage on vulnerable rune entry and starts exactly 500 ms of i-frames', () => {
    const state = atPosition(startRun(), { row: 1, column: 4 });
    const damaged = move(state, 'right', 2_000);

    expect(damaged.player.position).toEqual({ row: 1, column: 5 });
    expect(damaged.currentHealth).toBe(5);
    expect(damaged.invulnerability).toEqual({ expiresAt: 2_500, pendingRune: null });
    expect(damaged.lastDamage).toMatchObject({ amount: 1, source: 'rune', fatal: false });
    expect(INVULNERABILITY_DURATION_MS).toBe(500);
  });

  it('does not tick damage merely for remaining on a rune', () => {
    const damaged = move(atPosition(startRun(), { row: 1, column: 4 }), 'right', 2_000);
    const expired = expire(damaged, 2_500);

    expect(expired.currentHealth).toBe(5);
    expect(expired.invulnerability.expiresAt).toBeNull();
  });

  it('allows a rune to damage again after leaving and re-entering while vulnerable', () => {
    let state = move(atPosition(startRun(), { row: 1, column: 4 }), 'right', 2_000);
    state = move(state, 'left', 2_100);
    state = expire(state, 2_500);
    state = move(state, 'right', 2_600);

    expect(state.currentHealth).toBe(4);
    expect(state.invulnerability.expiresAt).toBe(3_100);
  });

  it('treats direct movement from rune A to rune B as a protected new entry', () => {
    const adjacentRunes = [
      { row: 1, column: 1 },
      { row: 1, column: 2 },
    ] as const;
    let state = atPosition(startRun(), { row: 1, column: 0 });
    state = move(state, 'right', 2_000, adjacentRunes);
    state = move(state, 'right', 2_100, adjacentRunes);

    expect(state.currentHealth).toBe(5);
    expect(state.player.position).toEqual(adjacentRunes[1]);
    expect(state.invulnerability).toEqual({
      expiresAt: 2_500,
      pendingRune: adjacentRunes[1],
    });
    expect(state.announcement).toBe('Damage avoided while invulnerable.');
  });

  it('applies exactly one delayed hit when the player remains on a pending rune', () => {
    const protectedState: GameplayState = {
      ...atPosition(startRun(), { row: 4, column: 1 }),
      currentHealth: 5,
      invulnerability: { expiresAt: 2_500, pendingRune: null },
    };
    const entered = move(protectedState, 'right', 2_100);
    const delayed = expire(entered, 2_500);
    const nextExpiry = expire(delayed, 3_000);

    expect(entered.currentHealth).toBe(5);
    expect(entered.invulnerability.expiresAt).toBe(2_500);
    expect(delayed.currentHealth).toBe(4);
    expect(delayed.invulnerability).toEqual({ expiresAt: 3_000, pendingRune: null });
    expect(nextExpiry.currentHealth).toBe(4);
    expect(nextExpiry.invulnerability.expiresAt).toBeNull();
  });

  it('cancels pending delayed damage when the player leaves the rune', () => {
    const protectedState: GameplayState = {
      ...atPosition(startRun(), { row: 4, column: 1 }),
      currentHealth: 5,
      invulnerability: { expiresAt: 2_500, pendingRune: null },
    };
    const entered = move(protectedState, 'right', 2_100);
    const left = move(entered, 'left', 2_200);
    const expired = expire(left, 2_500);

    expect(left.invulnerability.pendingRune).toBeNull();
    expect(expired.currentHealth).toBe(5);
  });

  it('does not restart i-frames for avoided damage', () => {
    const protectedState: GameplayState = {
      ...atPosition(startRun(), { row: 4, column: 1 }),
      invulnerability: { expiresAt: 2_500, pendingRune: null },
    };
    const entered = move(protectedState, 'right', 2_300);

    expect(entered.invulnerability.expiresAt).toBe(2_500);
  });

  it('does not activate runes for blocked movement or shielded turning', () => {
    let state = atPosition(startRun(), { row: 0, column: 0 });
    state = move(state, 'left', 2_000);
    state = gameplayReducer(state, { type: 'shield', isShielding: true });
    state = gameplayReducer(state, { type: 'turn', direction: 'down', trigger: 'press' });

    expect(state.currentHealth).toBe(6);
    expect(state.player.position).toEqual({ row: 0, column: 0 });
    expect(state.invulnerability.expiresAt).toBeNull();
  });

  it('preserves health on room reset and restores maximum health for a new run', () => {
    const damaged = applyPlayerDamage(startRun(), {
      id: 'damage-1',
      source: 'rune',
      amount: 2,
      timestamp: 2_000,
    });
    const roomReset = gameplayReducer(damaged, { type: 'reset-room' });
    const newRun = gameplayReducer(roomReset, {
      type: 'start-run',
      maximumHealth: 6,
      startedAt: 3_000,
      runId: 'run-2',
    });

    expect(roomReset.currentHealth).toBe(4);
    expect(newRun.currentHealth).toBe(6);
    expect(newRun.maximumHealth).toBe(6);
  });

  it('clamps fatal damage to zero, snapshots survival, and ignores future player input', () => {
    const shielding: GameplayState = {
      ...atPosition(startRun(1), { row: 4, column: 2 }),
      player: {
        ...atPosition(startRun(1), { row: 4, column: 2 }).player,
        isShielding: true,
        shieldDirection: 'right',
      },
    };
    const defeated = applyPlayerDamage(shielding, {
      id: 'fatal',
      source: 'rune',
      amount: 3,
      timestamp: 2_750,
    });
    const afterMove = move(defeated, 'left', 3_000);
    const afterAttack = gameplayReducer(afterMove, {
      type: 'attack',
      id: 'ignored',
      timestamp: 3_000,
    });

    expect(defeated).toMatchObject({
      status: 'defeated',
      currentHealth: 0,
      player: {
        position: { row: 4, column: 2 },
        isShielding: false,
        shieldDirection: null,
      },
      runStats: { timeSurvived: 1_750 },
      announcement: 'You were defeated.',
    });
    expect(afterAttack).toBe(defeated);
  });

  it('rejects stale expiry actions from an old run or timer', () => {
    const state: GameplayState = {
      ...startRun(),
      invulnerability: { expiresAt: 2_500, pendingRune: { row: 1, column: 5 } },
    };
    const wrongRun = gameplayReducer(state, {
      type: 'invulnerability-expired',
      runId: 'old-run',
      expectedExpiresAt: 2_500,
      timestamp: 2_500,
    });
    const wrongExpiry = gameplayReducer(state, {
      type: 'invulnerability-expired',
      runId: 'run-1',
      expectedExpiresAt: 2_400,
      timestamp: 2_500,
    });

    expect(wrongRun).toBe(state);
    expect(wrongExpiry).toBe(state);
  });

  it('derives elapsed survival time from timestamps and freezes the defeated value', () => {
    const active = startRun(6, 1_000);
    expect(getTimeSurvived(active.runStats, 43_500)).toBe(42_500);
    expect(formatSurvivalTime(42_500)).toBe('00:42');

    const defeated = applyPlayerDamage(
      { ...active, currentHealth: 1 },
      {
        id: 'fatal',
        source: 'rune',
        amount: 1,
        timestamp: 43_500,
      },
    );
    expect(getTimeSurvived(defeated.runStats, 99_999)).toBe(42_500);
  });
});
