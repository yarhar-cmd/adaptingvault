import type { AdaptiveProfile, ExperiencePreset } from '../types/adaptation';
import type { EnemyCountPlan, EnemyRoomState, RatEnemy } from '../types/enemies';
import { RAT_MAX_HEALTH, RAT_MOVEMENT_INTERVAL_MS, type EnemySpawnSource } from '../types/enemies';
import type { EnemySpawnDefinition, RoomDefinition, TileCoordinate } from '../types/rooms';
import {
  coordinateKey,
  coordinatesMatch,
  getCollapsedEntrance,
  getFloorLookup,
  getWallLookup,
  isCoordinateInRoom,
} from './roomGeometry';
import { createSeededRandom, shuffleSeeded } from './seededRandom';

export const RAT_PATH_NEIGHBOR_ORDER = ['north', 'west', 'east', 'south'] as const;
const offsets = {
  north: { x: 0, y: -1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
};

export function cardinalDistance(left: TileCoordinate, right: TileCoordinate): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function isLivingRat(rat: RatEnemy): boolean {
  return rat.health > 0 && rat.state !== 'corpse';
}

export function livingRats(enemyState: EnemyRoomState): RatEnemy[] {
  return enemyState.rats.filter(isLivingRat);
}

function pathNeighbors(coordinate: TileCoordinate): TileCoordinate[] {
  return RAT_PATH_NEIGHBOR_ORDER.map((direction) => ({
    x: coordinate.x + offsets[direction].x,
    y: coordinate.y + offsets[direction].y,
  }));
}

function isStaticRatPathTile(
  room: RoomDefinition,
  tile: TileCoordinate,
  player: TileCoordinate,
): boolean {
  if (!isCoordinateInRoom(room, tile)) return false;
  if (coordinatesMatch(tile, player)) return true;
  const key = coordinateKey(tile);
  return (
    getFloorLookup(room).has(key) &&
    !getWallLookup(room).has(key) &&
    !room.exits.some((exit) => coordinatesMatch(exit.tile, tile))
  );
}

export function findRatPath(
  room: RoomDefinition,
  start: TileCoordinate,
  player: TileCoordinate,
  occupied: ReadonlySet<string> = new Set(),
): TileCoordinate[] | null {
  if (cardinalDistance(start, player) <= 1) return [start];
  const queue: TileCoordinate[] = [start];
  const visited = new Set([coordinateKey(start)]);
  const previous = new Map<string, TileCoordinate>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of pathNeighbors(current)) {
      const key = coordinateKey(next);
      if (
        visited.has(key) ||
        (occupied.has(key) && !coordinatesMatch(next, player)) ||
        !isStaticRatPathTile(room, next, player)
      )
        continue;
      visited.add(key);
      previous.set(key, current);
      if (coordinatesMatch(next, player)) {
        const path = [next];
        let cursor = next;
        while (!coordinatesMatch(cursor, start)) {
          cursor = previous.get(coordinateKey(cursor))!;
          path.unshift(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

export function pathDistance(
  room: RoomDefinition,
  start: TileCoordinate,
  target: TileCoordinate,
): number | null {
  const path = findRatPath(room, start, target);
  return path ? path.length - 1 : null;
}

function ratPathDistances(room: RoomDefinition, start: TileCoordinate): Map<string, number> {
  const distances = new Map([[coordinateKey(start), 0]]);
  const queue = [start];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex++]!;
    const distance = distances.get(coordinateKey(current))!;
    for (const next of pathNeighbors(current)) {
      const key = coordinateKey(next);
      if (distances.has(key) || !isStaticRatPathTile(room, next, start)) continue;
      distances.set(key, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

export function nextRatPathStep(
  room: RoomDefinition,
  rat: RatEnemy,
  player: TileCoordinate,
  occupied: ReadonlySet<string>,
): TileCoordinate | null {
  const path = findRatPath(room, rat.position, player, occupied);
  if (!path || path.length <= 2) return null;
  return path[1] ?? null;
}

export function directionFromPlayerToRat(
  player: TileCoordinate,
  rat: TileCoordinate,
): 'up' | 'down' | 'left' | 'right' | null {
  if (rat.x === player.x && rat.y === player.y - 1) return 'up';
  if (rat.x === player.x && rat.y === player.y + 1) return 'down';
  if (rat.x === player.x - 1 && rat.y === player.y) return 'left';
  if (rat.x === player.x + 1 && rat.y === player.y) return 'right';
  return null;
}

export function createRatFromSpawn(
  spawn: EnemySpawnDefinition,
  now: number,
  source: EnemySpawnSource = spawn.source,
): RatEnemy {
  return {
    id: spawn.id,
    type: 'rat',
    position: { ...spawn.tile },
    health: RAT_MAX_HEALTH,
    state: 'chasing',
    lockedTarget: null,
    nextMovementAt: now + RAT_MOVEMENT_INTERVAL_MS,
    telegraphEndsAt: null,
    cooldownEndsAt: null,
    corpseEndsAt: null,
    hitFlashUntil: null,
    defeatCounted: false,
    spawnSource: source,
    spawnReason: spawn.reason,
    authoredSpawnNumber: spawn.source === 'authored' ? spawn.order : undefined,
    nextPathStep: null,
  };
}

export function authoredRatCount(preset: ExperiencePreset): number {
  if (preset === 'new-delver') return 1;
  if (preset === 'seasoned-adventurer') return 2;
  return 3;
}

export function createRoomEnemyState(
  room: RoomDefinition,
  preset: ExperiencePreset,
  now: number,
  countPlan: EnemyCountPlan | null = null,
): EnemyRoomState {
  const ordered = [...(room.enemySpawns ?? [])].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
  const count =
    room.phase === 'evaluation'
      ? Math.min(authoredRatCount(preset), ordered.length)
      : ordered.length;
  return {
    roomId: room.id,
    rats: ordered.slice(0, count).map((spawn) => createRatFromSpawn(spawn, now)),
    aiFrozen: false,
    countPlan,
    lastBlockAt: null,
    lastTickAt: now,
  };
}

export function emptyEnemyRoomState(roomId = ''): EnemyRoomState {
  return {
    roomId,
    rats: [],
    aiFrozen: false,
    countPlan: null,
    lastBlockAt: null,
    lastTickAt: null,
  };
}

const presetCaps: Record<ExperiencePreset, number> = {
  'new-delver': 2,
  'seasoned-adventurer': 3,
  'dungeon-veteran': 4,
};

export function selectGeneratedRatSpawns(
  room: RoomDefinition,
  input: {
    roomSeed: string;
    preset: ExperiencePreset;
    profile: AdaptiveProfile;
    mode: 'reinforce' | 'poke';
    playerSpawn: TileCoordinate;
  },
): { spawns: EnemySpawnDefinition[]; plan: EnemyCountPlan } {
  const cap = presetCaps[input.preset];
  const area = room.floorTiles.length;
  const hazardDensity = (room.hazards?.length ?? 0) / Math.max(1, area);
  const roomSizeAdjustment = Math.max(-1, Math.min(1.25, (area - 90) / 90));
  const shapeAdjustment = room.shape === 'l-shape' ? -0.35 : 0;
  const hazardAdjustment = -Math.min(1.25, hazardDensity * 20);
  const adaptationAdjustment =
    (input.profile.aggression - 0.5) * 0.8 -
    (input.profile.caution - 0.5) * 0.45 -
    Math.max(0, input.profile.hazardTolerance - 0.5) * hazardDensity * 5;
  const presetAdjustment =
    input.preset === 'new-delver' ? -0.25 : input.preset === 'dungeon-veteran' ? 0.35 : 0;
  const modeAdjustment = input.mode === 'poke' ? 0.3 : 0;
  const random = createSeededRandom(`${input.roomSeed}:rats`);
  const basePressure = random() * (cap + 0.75) - 0.6;
  const requestedCount = Math.max(
    0,
    Math.min(
      cap,
      Math.round(
        basePressure +
          roomSizeAdjustment +
          shapeAdjustment +
          hazardAdjustment +
          adaptationAdjustment +
          presetAdjustment +
          modeAdjustment,
      ),
    ),
  );
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const exits = room.exits.map((exit) => exit.tile);
  const collapsed = getCollapsedEntrance(room, room.entrance?.direction ?? 'west');
  const distancesFromPlayer = ratPathDistances(room, input.playerSpawn);
  const candidates = shuffleSeeded(
    random,
    room.floorTiles.filter((tile) => {
      if (
        coordinatesMatch(tile, input.playerSpawn) ||
        hazards.has(coordinateKey(tile)) ||
        exits.some((exit) => cardinalDistance(exit, tile) < 2) ||
        (collapsed && coordinatesMatch(collapsed, tile))
      )
        return false;
      const distance = distancesFromPlayer.get(coordinateKey(tile));
      return distance !== undefined && distance >= 5;
    }),
  );
  const selected: TileCoordinate[] = [];
  for (const tile of candidates) {
    if (selected.length >= requestedCount) break;
    if (selected.every((other) => !coordinatesMatch(other, tile))) selected.push(tile);
  }
  const spawns = selected.map((tile, index) => ({
    id: `${room.id}-rat-${index + 1}`,
    type: 'rat' as const,
    tile,
    order: index + 1,
    source: 'generated' as const,
    reason: `Deterministic generated spawn ${index + 1}`,
  }));
  return {
    spawns,
    plan: {
      cap,
      basePressure,
      roomSizeAdjustment,
      shapeAdjustment,
      hazardAdjustment,
      adaptationAdjustment,
      presetAdjustment,
      requestedCount,
      selectedCount: spawns.length,
    },
  };
}
