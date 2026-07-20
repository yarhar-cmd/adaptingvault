import { describe, expect, it } from 'vitest';
import { RAT_COMBAT_CONFIG } from '../config/combat';
import { createCombatMetrics, type EnemyRoomState, type RatEnemy } from '../types/enemies';
import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import { createRatFromSpawn } from './enemySystem';
import { createGameplayState, gameplayReducer, type GameplayState } from './gameplayState';
import { coordinateToGridPosition, createRectangularRoom } from './roomGeometry';

const START = 1_000;
const AWARE_AT = START + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs;
const IMPACT_AT = AWARE_AT + RAT_COMBAT_CONFIG.telegraphMs;

function room(wallTiles: TileCoordinate[] = []): RoomDefinition {
  const base = createRectangularRoom({
    id: 'combat-room',
    phase: 'dungeon',
    width: 9,
    height: 7,
    exitEnabled: true,
  });
  return { ...base, wallTiles: [...(base.wallTiles ?? []), ...wallTiles] };
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
    lastBlockKind: null,
    lastTickAt: START,
    awarenessGraceEndsAt: AWARE_AT,
    combatMetrics: createCombatMetrics(),
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

function tick(state: GameplayState, timestamp: number, fixture = room()) {
  return gameplayReducer(state, { type: 'enemy-tick', timestamp, room: fixture });
}

function move(state: GameplayState, direction: 'up' | 'down' | 'left' | 'right', at: number) {
  return gameplayReducer(state, {
    type: 'move',
    direction,
    trigger: 'press',
    id: `move-${at}`,
    timestamp: at,
    room: room(),
  });
}

function adjacentTelegraph(health = 6) {
  return tick(active({ x: 3, y: 3 }, [{ x: 4, y: 3 }], health), AWARE_AT);
}

describe('Resonant Ruins Rat combat and kiting v0.2', () => {
  it('honors room-entry grace, alerts by path distance, then moves at the fixed interval', () => {
    let state = active({ x: 2, y: 3 }, [{ x: 5, y: 3 }]);
    state = tick(state, AWARE_AT - 1);
    expect(state.enemies.rats[0]).toMatchObject({ state: 'idle', awareness: 'unaware' });

    state = tick(state, AWARE_AT);
    expect(state.enemies.rats[0]).toMatchObject({
      state: 'chasing',
      awareness: 'alerted',
      position: { x: 5, y: 3 },
      nextMovementAt: AWARE_AT + RAT_COMBAT_CONFIG.movementIntervalMs,
    });
    state = tick(state, AWARE_AT + RAT_COMBAT_CONFIG.movementIntervalMs);
    expect(state.enemies.rats[0]).toMatchObject({
      position: { x: 4, y: 3 },
      facing: 'left',
    });
  });

  it('locks the target, resolves a dodge once at lunge entry, and always recovers', () => {
    let state = adjacentTelegraph();
    expect(state.enemies.rats[0]).toMatchObject({
      state: 'telegraphing',
      lockedTarget: { x: 3, y: 3 },
      telegraphEndsAt: IMPACT_AT,
    });
    state = move(state, 'left', AWARE_AT + 100);
    state = tick(state, IMPACT_AT);
    expect(state.currentHealth).toBe(6);
    expect(state.enemies.rats[0]).toMatchObject({
      state: 'lunging',
      attackOutcome: 'miss',
      lungeEndsAt: IMPACT_AT + RAT_COMBAT_CONFIG.lungeMs,
    });
    expect(state.enemies.combatMetrics.attacksDodged).toBe(1);

    state = tick(state, IMPACT_AT + RAT_COMBAT_CONFIG.lungeMs);
    expect(state.enemies.rats[0]).toMatchObject({
      state: 'recovering',
      recoveryEndsAt: IMPACT_AT + RAT_COMBAT_CONFIG.lungeMs + RAT_COMBAT_CONFIG.recoveryMs,
    });
  });

  it('lands once when the player remains on the locked tile and uses universal i-frames', () => {
    let state = adjacentTelegraph();
    state = tick(state, IMPACT_AT);
    expect(state.currentHealth).toBe(5);
    expect(state.invulnerability.expiresAt).toBe(
      IMPACT_AT + RAT_COMBAT_CONFIG.playerDamageInvulnerabilityMs,
    );
    expect(tick(state, IMPACT_AT + 1).currentHealth).toBe(5);
    expect(state.enemies.rats[0]?.attackOutcome).toBe('hit');
  });

  it('treats an early correctly held shield as a regular block', () => {
    let state = adjacentTelegraph();
    state = gameplayReducer(state, {
      type: 'shield',
      isShielding: true,
      timestamp: IMPACT_AT - RAT_COMBAT_CONFIG.perfectBlockWindowMs - 1,
    });
    state = tick(state, IMPACT_AT);
    expect(state.currentHealth).toBe(6);
    expect(state.enemies.lastBlockKind).toBe('regular');
    expect(state.enemies.rats[0]).toMatchObject({
      attackOutcome: 'block',
      recoveryKind: 'standard',
    });
  });

  it('awards a perfect block for a fresh correct shield raise in the final window', () => {
    let state = adjacentTelegraph();
    state = gameplayReducer(state, {
      type: 'shield',
      isShielding: true,
      timestamp: IMPACT_AT - 80,
    });
    state = tick(state, IMPACT_AT);
    expect(state.enemies.lastBlockKind).toBe('perfect');
    expect(state.enemies.rats[0]).toMatchObject({
      attackOutcome: 'perfect-block',
      recoveryKind: 'perfect-block',
    });
    state = tick(state, IMPACT_AT + RAT_COMBAT_CONFIG.lungeMs);
    expect(state.enemies.rats[0]?.recoveryEndsAt).toBe(
      IMPACT_AT + RAT_COMBAT_CONFIG.lungeMs + RAT_COMBAT_CONFIG.perfectBlockRecoveryMs,
    );
  });

  it('awards a perfect block when an already-held shield turns correctly in the final window', () => {
    let state = adjacentTelegraph();
    state = gameplayReducer(state, {
      type: 'turn',
      direction: 'up',
      trigger: 'press',
      timestamp: AWARE_AT + 20,
    });
    state = gameplayReducer(state, {
      type: 'shield',
      isShielding: true,
      timestamp: AWARE_AT + 30,
    });
    state = gameplayReducer(state, {
      type: 'turn',
      direction: 'right',
      trigger: 'press',
      timestamp: IMPACT_AT - 60,
    });
    state = tick(state, IMPACT_AT);
    expect(state.enemies.rats[0]?.attackOutcome).toBe('perfect-block');
  });

  it('allows sword damage during telegraph and cancels only a lethal pending attack', () => {
    let state = adjacentTelegraph();
    state = gameplayReducer(state, {
      type: 'attack',
      id: 'first-hit',
      timestamp: AWARE_AT + 1,
      room: room(),
    });
    expect(state.enemies.rats[0]).toMatchObject({ health: 1, state: 'telegraphing' });
    state = gameplayReducer(state, {
      type: 'attack',
      id: 'lethal-hit',
      timestamp: AWARE_AT + 401,
      room: room(),
    });
    expect(state.enemies.rats[0]).toMatchObject({ health: 0, state: 'corpse' });
    expect(state.enemies.combatMetrics.attacksCancelledByDefeat).toBe(1);
    expect(tick(state, IMPACT_AT).currentHealth).toBe(6);
  });

  it('allows simultaneous telegraphs and resolves attacks deterministically with i-frames', () => {
    let state = active({ x: 3, y: 3 }, [
      { x: 4, y: 3 },
      { x: 2, y: 3 },
    ]);
    state = tick(state, AWARE_AT);
    expect(state.enemies.rats.every((rat) => rat.state === 'telegraphing')).toBe(true);
    state = tick(state, IMPACT_AT);
    expect(state.currentHealth).toBe(5);
    expect(state.adaptation.signals.enemyAttacksLanded).toBe(2);
    expect(state.enemies.combatMetrics.attacksLanded).toBe(2);
  });

  it('alerts an attacked Rat and nearby Rats within three path tiles, but not distant Rats', () => {
    let state = active({ x: 2, y: 3 }, [
      { x: 3, y: 3 },
      { x: 6, y: 3 },
      { x: 7, y: 4 },
    ]);
    state = gameplayReducer(state, {
      type: 'attack',
      id: 'alerting-hit',
      timestamp: START + 100,
      room: room(),
    });
    expect(state.enemies.rats.map((rat) => rat.awareness)).toEqual([
      'alerted',
      'alerted',
      'unaware',
    ]);
  });

  it('prevents an avoidable final escape-tile body lock using deterministic reservations', () => {
    let state = active({ x: 3, y: 3 }, [
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 3 },
    ]);
    const hold = (rat: RatEnemy): RatEnemy => ({
      ...rat,
      awareness: 'alerted',
      state: 'recovering',
      recoveryKind: 'standard',
      recoveryEndsAt: START + 10_000,
    });
    state = {
      ...state,
      enemies: {
        ...state.enemies,
        awarenessGraceEndsAt: null,
        rats: [
          hold(state.enemies.rats[0]!),
          hold(state.enemies.rats[1]!),
          hold(state.enemies.rats[2]!),
          {
            ...state.enemies.rats[3]!,
            awareness: 'alerted',
            state: 'chasing',
            nextMovementAt: AWARE_AT,
          },
        ],
      },
    };
    state = tick(state, AWARE_AT);
    expect(state.enemies.rats[3]?.position).not.toEqual({ x: 4, y: 3 });
    expect(state.enemies.combatMetrics.bodyLockPreventionActivations).toBe(1);
  });

  it('does not falsely protect the only route in a genuine geometric dead end', () => {
    const fixture = room([
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 4 },
    ]);
    let state = active({ x: 3, y: 3 }, [{ x: 5, y: 3 }]);
    state = {
      ...state,
      enemies: {
        ...state.enemies,
        awarenessGraceEndsAt: null,
        rats: [
          {
            ...state.enemies.rats[0]!,
            awareness: 'alerted',
            state: 'chasing',
            nextMovementAt: AWARE_AT,
          },
        ],
      },
    };
    state = tick(state, AWARE_AT, fixture);
    expect(state.enemies.rats[0]?.position).toEqual({ x: 4, y: 3 });
    expect(state.enemies.combatMetrics.bodyLockPreventionActivations).toBe(0);
  });

  it('freezes and resumes telegraph, lunge, recovery, and awareness deadlines exactly', () => {
    let state = adjacentTelegraph();
    state = gameplayReducer(state, {
      type: 'pause-run',
      timestamp: AWARE_AT + 100,
      reason: 'pause-menu',
    });
    const duringPause = tick(state, START + 5_000);
    expect(duringPause.enemies.rats[0]?.telegraphEndsAt).toBe(IMPACT_AT);
    state = gameplayReducer(duringPause, { type: 'resume-run', timestamp: START + 5_100 });
    expect(state.enemies.rats[0]?.telegraphEndsAt).toBe(IMPACT_AT + 4_500);
    expect(state.player.isShielding).toBe(false);
    expect(state.shieldTiming).toEqual({ raisedAt: null, lastFacingChangedAt: null });
  });

  it('ignores every later enemy tick after Rat damage defeats the player', () => {
    let state = adjacentTelegraph(1);
    state = tick(state, IMPACT_AT);
    expect(state.status).toBe('defeated');
    expect(tick(state, START + 10_000)).toBe(state);
  });
});
