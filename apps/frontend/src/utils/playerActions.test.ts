import { describe, expect, it } from 'vitest';
import type { CardinalDirection, PlayerState } from '../types/player';
import { attemptMove, createAttackAction, getProtectedTile, turnPlayer } from './playerActions';

const bounds = { rows: 5, columns: 8 } as const;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    position: { row: 2, column: 2 },
    facing: 'right',
    isShielding: false,
    shieldDirection: null,
    ...overrides,
  };
}

describe('Resonant Ruins player actions', () => {
  it.each<[CardinalDirection, number, number]>([
    ['up', 1, 2],
    ['down', 3, 2],
    ['left', 2, 1],
    ['right', 2, 3],
  ])('moves one tile %s', (direction, row, column) => {
    const movement = attemptMove(player(), direction, { bounds }, `move-${direction}`);

    expect(movement.player.position).toEqual({ row, column });
    expect(movement.player.facing).toBe(direction);
    expect(movement.result).toMatchObject({ moved: true, blockedReason: null });
  });

  it('blocks room boundaries while still updating facing', () => {
    const movement = attemptMove(
      player({ position: { row: 0, column: 2 }, facing: 'right' }),
      'up',
      { bounds },
      'move-boundary',
    );

    expect(movement.player.position).toEqual({ row: 0, column: 2 });
    expect(movement.player.facing).toBe('up');
    expect(movement.result).toMatchObject({ moved: false, blockedReason: 'bounds' });
    expect(movement.result.attemptedTarget).toEqual({ row: -1, column: 2 });
  });

  it('turns a shielding player without moving or producing a collision result', () => {
    const shieldingPlayer = player({
      position: { row: 0, column: 2 },
      facing: 'right',
      isShielding: true,
      shieldDirection: 'right',
    });

    const turnedPlayer = turnPlayer(shieldingPlayer, 'up');

    expect(turnedPlayer.position).toBe(shieldingPlayer.position);
    expect(turnedPlayer).toMatchObject({
      position: { row: 0, column: 2 },
      facing: 'up',
      isShielding: true,
      shieldDirection: 'up',
    });
  });

  it('uses an injected blocked-tile predicate without treating current room entities as blockers', () => {
    const blocked = attemptMove(
      player(),
      'right',
      { bounds, isBlocked: ({ row, column }) => row === 2 && column === 3 },
      'move-wall',
    );
    const currentEntityTile = attemptMove(player(), 'left', { bounds }, 'move-entity');

    expect(blocked.result.blockedReason).toBe('tile');
    expect(blocked.player.position).toEqual({ row: 2, column: 2 });
    expect(currentEntityTile.result.moved).toBe(true);
  });

  it('keeps shielding active and turns the protected direction during movement', () => {
    const movement = attemptMove(
      player({ isShielding: true, shieldDirection: 'right' }),
      'down',
      { bounds },
      'move-shield',
    );

    expect(movement.player).toMatchObject({
      isShielding: true,
      facing: 'down',
      shieldDirection: 'down',
    });
    expect(getProtectedTile(movement.player, bounds)).toEqual({ row: 4, column: 2 });
  });

  it('creates a reusable one-damage attack action', () => {
    const attack = createAttackAction(player(), { bounds }, 'attack-1', 1234);

    expect(attack).toEqual({
      id: 'attack-1',
      source: { row: 2, column: 2 },
      attemptedTarget: { row: 2, column: 3 },
      target: { row: 2, column: 3 },
      facing: 'right',
      damage: 1,
      timestamp: 1234,
      blockedReason: null,
    });
  });

  it('represents an attack outside the room without producing a renderable target', () => {
    const attack = createAttackAction(
      player({ position: { row: 0, column: 2 }, facing: 'up' }),
      { bounds },
      'attack-edge',
      5678,
    );

    expect(attack.source).toEqual({ row: 0, column: 2 });
    expect(attack.attemptedTarget).toEqual({ row: -1, column: 2 });
    expect(attack.target).toBeNull();
    expect(attack.blockedReason).toBe('bounds');
  });

  it('returns no protected tile outside the room while retaining shield state', () => {
    const edgePlayer = player({
      position: { row: 0, column: 2 },
      facing: 'up',
      isShielding: true,
      shieldDirection: 'up',
    });

    expect(getProtectedTile(edgePlayer, bounds)).toBeNull();
    expect(edgePlayer.isShielding).toBe(true);
  });
});
