import { describe, expect, it } from 'vitest';
import type { EnemyRoomState } from '../types/enemies';
import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import { createRatFromSpawn } from './enemySystem';
import { createGameplayState, gameplayReducer, type GameplayState } from './gameplayState';
import { coordinateToGridPosition, createRectangularRoom } from './roomGeometry';

const START = 1_000;

function room(): RoomDefinition {
  return createRectangularRoom({
    id: 'combat-room',
    phase: 'dungeon',
    width: 9,
    height: 7,
    exitEnabled: true,
  });
}

function enemies(positions: TileCoordinate[]): EnemyRoomState {
  return {
    roomId: 'combat-room',
    rats: positions.map((tile, index) =>
      createRatFromSpawn(
        {
          id: `rat-${index + 1}`,
          type: 'rat',
          tile,
          order: index + 1,
          source: 'generated',
          reason: 'Combat test',
        },
        START,
      ),
    ),
    aiFrozen: false,
    countPlan: null,
    lastBlockAt: null,
    lastTickAt: START,
  };
}

function active(player: TileCoordinate, rats: TileCoordinate[], health = 6): GameplayState {
  return gameplayReducer(createGameplayState(health), {
    type: 'start-run',
    maximumHealth: health,
    startedAt: START,
    runId: 'combat-run',
    runSeed: 'combat-seed',
    experiencePreset: 'seasoned-adventurer',
    currentRoomId: 'combat-room',
    spawn: coordinateToGridPosition(player),
    enemies: enemies(rats),
  });
}

function tick(state: GameplayState, timestamp: number) {
  return gameplayReducer(state, { type: 'enemy-tick', timestamp, room: room() });
}

describe('Resonant Ruins Rat combat', () => {
  it('moves one cardinal tile at the fixed interval, stops adjacent, and telegraphs', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 5, y: 3 }]);
    expect(tick(state, START + 332).enemies.rats[0]!.position).toEqual({ x: 5, y: 3 });
    state = tick(state, START + 333);
    expect(state.enemies.rats[0]!.position).toEqual({ x: 4, y: 3 });
    state = tick(state, START + 666);
    expect(state.enemies.rats[0]!.position).toEqual({ x: 3, y: 3 });
    state = tick(state, START + 667);
    expect(state.enemies.rats[0]).toMatchObject({
      state: 'telegraphing',
      lockedTarget: { x: 2, y: 3 },
      telegraphEndsAt: START + 967,
    });
  });

  it('locks the target tile, misses a moved player, and enters exact cooldown', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 3, y: 3 }]);
    state = tick(state, START + 1);
    state = gameplayReducer(state, {
      type: 'move',
      direction: 'left',
      trigger: 'press',
      id: 'dodge',
      timestamp: START + 100,
      room: room(),
    });
    state = tick(state, START + 301);
    expect(state.currentHealth).toBe(6);
    expect(state.adaptation.signals.enemyAttacksMissed).toBe(1);
    expect(state.enemies.rats[0]).toMatchObject({
      state: 'cooldown',
      cooldownEndsAt: START + 1_501,
    });
  });

  it('checks current shield direction at impact and blocks every attack from that direction', () => {
    let state = active({ x: 3, y: 3 }, [
      { x: 4, y: 3 },
      { x: 4, y: 2 },
    ]);
    state = tick(state, START + 1);
    state = gameplayReducer(state, { type: 'shield', isShielding: true, timestamp: START + 200 });
    state = gameplayReducer(state, {
      type: 'turn',
      direction: 'right',
      trigger: 'press',
      timestamp: START + 250,
    });
    state = tick(state, START + 301);
    expect(state.currentHealth).toBe(6);
    expect(state.adaptation.signals.enemyAttacksBlocked).toBe(1);
    expect(state.enemies.lastBlockAt).toBe(START + 301);
  });

  it('allows simultaneous attacks while universal i-frames limit damage to one point', () => {
    let state = active({ x: 3, y: 3 }, [
      { x: 4, y: 3 },
      { x: 2, y: 3 },
    ]);
    state = tick(state, START + 1);
    state = tick(state, START + 301);
    expect(state.currentHealth).toBe(5);
    expect(state.invulnerability.expiresAt).toBe(START + 801);
    expect(state.adaptation.signals.enemyAttacksLanded).toBe(2);
  });

  it('blocks movement into living Rats and makes a two-hit sword kill non-blocking immediately', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 3, y: 3 }]);
    state = gameplayReducer(state, {
      type: 'move',
      direction: 'right',
      trigger: 'press',
      id: 'blocked',
      timestamp: START + 1,
      room: room(),
    });
    expect(state.player.position).toEqual({ row: 3, column: 2 });
    expect(state.blockedMove?.blockedReason).not.toBeNull();

    state = gameplayReducer(state, {
      type: 'attack',
      id: 'swing-1',
      timestamp: START + 10,
      room: room(),
    });
    expect(state.enemies.rats[0]).toMatchObject({ health: 1, state: 'chasing' });
    state = gameplayReducer(state, {
      type: 'attack',
      id: 'swing-2',
      timestamp: START + 410,
      room: room(),
    });
    expect(state.enemies.rats[0]).toMatchObject({
      health: 0,
      state: 'corpse',
      corpseEndsAt: START + 1_110,
    });
    expect(state.runStats.enemiesDefeated).toBe(1);

    state = gameplayReducer(state, {
      type: 'move',
      direction: 'right',
      trigger: 'press',
      id: 'through-corpse',
      timestamp: START + 420,
      room: room(),
    });
    expect(state.player.position).toEqual({ row: 3, column: 3 });
    expect(tick(state, START + 1_109).enemies.rats).toHaveLength(1);
    expect(tick(state, START + 1_110).enemies.rats).toHaveLength(0);
  });

  it('shifts all Rat deadlines by the exact paused duration', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 3, y: 3 }]);
    state = tick(state, START + 1);
    state = gameplayReducer(state, {
      type: 'pause-run',
      timestamp: START + 100,
      reason: 'pause-menu',
    });
    const duringPause = tick(state, START + 5_000);
    expect(duringPause.enemies.rats[0]!.telegraphEndsAt).toBe(START + 301);
    state = gameplayReducer(duringPause, { type: 'resume-run', timestamp: START + 5_100 });
    expect(state.enemies.rats[0]!.telegraphEndsAt).toBe(START + 5_301);
    expect(tick(state, START + 5_300).currentHealth).toBe(6);
    expect(tick(state, START + 5_301).currentHealth).toBe(5);
  });

  it('freezes Rat timers without freezing player actions', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 3, y: 3 }]);
    state = tick(state, START + 1);
    state = gameplayReducer(state, { type: 'debug-freeze-enemy-ai', frozen: true });
    state = gameplayReducer(state, {
      type: 'turn',
      direction: 'up',
      trigger: 'press',
      timestamp: START + 100,
    });
    expect(state.player.facing).toBe('up');
    state = tick(state, START + 5_001);
    expect(state.enemies.rats[0]!.telegraphEndsAt).toBe(START + 5_301);
    expect(state.currentHealth).toBe(6);
  });

  it('cancels lethal telegraphs and ignores all enemy ticks after player defeat', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 3, y: 3 }], 1);
    state = tick(state, START + 1);
    state = tick(state, START + 301);
    expect(state.status).toBe('defeated');
    expect(tick(state, START + 10_000)).toBe(state);
  });
});
