import type { RoomDefinition, RoomExit, TileCoordinate } from '../types/rooms';
import type { RoomValidationResult } from '../types/generation';
import {
  coordinateKey,
  coordinatesMatch,
  getFloorLookup,
  getWallLookup,
  isCoordinateInRoom,
} from './roomGeometry';
import { cardinalDistance, pathDistance } from './enemySystem';

const cardinalNeighbors = ({ x, y }: TileCoordinate): TileCoordinate[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

function onBoundary(room: RoomDefinition, tile: TileCoordinate): boolean {
  return tile.x === 0 || tile.y === 0 || tile.x === room.width - 1 || tile.y === room.height - 1;
}

function onDirectionalBoundary(room: RoomDefinition, tile: TileCoordinate, direction: string) {
  if (direction === 'north') return tile.y === 0;
  if (direction === 'south') return tile.y === room.height - 1;
  if (direction === 'west') return tile.x === 0;
  if (direction === 'east') return tile.x === room.width - 1;
  return false;
}

function manhattan(left: TileCoordinate, right: TileCoordinate): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function hasDuplicateCoordinates(coordinates: readonly TileCoordinate[]): boolean {
  return new Set(coordinates.map(coordinateKey)).size !== coordinates.length;
}

function validGeneratedExitStructure(exit: RoomExit): boolean {
  return (
    exit.kind === 'standard' &&
    (exit.condition?.type === 'always' || exit.condition?.type === 'enemies-defeated') &&
    exit.destination?.type === 'next-generated-room'
  );
}

export function validateEnemySpawns(
  room: RoomDefinition,
  options: { generated: boolean; playerSpawn?: TileCoordinate } = { generated: false },
): string[] {
  const errors: string[] = [];
  const spawns = room.enemySpawns ?? [];
  const floor = getFloorLookup(room);
  const walls = getWallLookup(room);
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const playerSpawn =
    options.playerSpawn ??
    (room.entrance ? room.spawnPoints?.[room.entrance.direction] : room.spawnPoints?.west);
  if (new Set(spawns.map((spawn) => spawn.id)).size !== spawns.length)
    errors.push('duplicate-enemy-spawn-id');
  if (hasDuplicateCoordinates(spawns.map((spawn) => spawn.tile)))
    errors.push('duplicate-enemy-spawn-coordinate');
  const orders = spawns.map((spawn) => spawn.order).sort((left, right) => left - right);
  if (orders.some((order, index) => order !== index + 1)) errors.push('invalid-enemy-spawn-order');
  for (const spawn of spawns) {
    const key = coordinateKey(spawn.tile);
    if (!isCoordinateInRoom(room, spawn.tile)) errors.push('enemy-spawn-out-of-bounds');
    if (!floor.has(key) || walls.has(key)) errors.push('enemy-spawn-not-walkable');
    if (hazards.has(key)) errors.push('enemy-spawn-hazard-overlap');
    if (room.exits.some((exit) => coordinatesMatch(exit.tile, spawn.tile)))
      errors.push('enemy-spawn-exit-overlap');
    if (playerSpawn && coordinatesMatch(playerSpawn, spawn.tile))
      errors.push('enemy-spawn-player-overlap');
    if (playerSpawn) {
      const distance = pathDistance(room, spawn.tile, playerSpawn);
      if (distance === null) errors.push('enemy-spawn-no-player-path');
      if (options.generated && distance !== null && distance < 5)
        errors.push('enemy-spawn-too-close-to-player');
    }
    if (options.generated && room.exits.some((exit) => cardinalDistance(exit.tile, spawn.tile) < 2))
      errors.push('enemy-spawn-too-close-to-exit');
  }
  if (
    spawns.length > 0 &&
    room.exits.some((exit) => exit.enabled && exit.condition.type !== 'enemies-defeated')
  )
    errors.push('enemy-lock-exit-condition-missing');
  return [...new Set(errors)];
}

export function hasSafePath(
  room: RoomDefinition,
  spawn: TileCoordinate,
  destination: TileCoordinate,
): boolean {
  const floor = getFloorLookup(room);
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const blockedEntrance = room.entrance ? coordinateKey(room.entrance.tile) : '';
  const disabledExits = new Set(
    room.exits.filter((exit) => !exit.enabled).map((exit) => coordinateKey(exit.tile)),
  );
  const queue = [spawn];
  const visited = new Set([coordinateKey(spawn)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (coordinatesMatch(current, destination)) return true;
    for (const next of cardinalNeighbors(current)) {
      const key = coordinateKey(next);
      if (
        visited.has(key) ||
        hazards.has(key) ||
        (disabledExits.has(key) && !coordinatesMatch(next, destination)) ||
        key === blockedEntrance ||
        !floor.has(key)
      )
        continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

export function validateGeneratedRoom(room: RoomDefinition): RoomValidationResult {
  const errors: string[] = [];
  const minWidth = room.shape === 'l-shape' ? 11 : 9;
  const minHeight = room.shape === 'l-shape' ? 11 : 9;
  if (
    room.phase !== 'dungeon' ||
    !Number.isSafeInteger(room.width) ||
    !Number.isSafeInteger(room.height) ||
    room.width < minWidth ||
    room.width > 21 ||
    room.height < minHeight ||
    room.height > 15
  )
    errors.push('dimensions-out-of-bounds');

  const floorTiles = room.floorTiles ?? [];
  const wallTiles = room.wallTiles ?? [];
  const hazards = room.hazards ?? [];
  const floor = getFloorLookup(room);
  const walls = getWallLookup(room);
  const hazardLookup = new Set(hazards.map(coordinateKey));

  if (floorTiles.some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('floor-out-of-bounds');
  if (hasDuplicateCoordinates(floorTiles)) errors.push('duplicate-floor');
  if (wallTiles.some((tile) => !isCoordinateInRoom(room, tile))) errors.push('wall-out-of-bounds');
  if (hasDuplicateCoordinates(wallTiles)) errors.push('duplicate-wall');
  if (floorTiles.some((tile) => walls.has(coordinateKey(tile)))) errors.push('floor-wall-conflict');
  if (hazards.some((tile) => !isCoordinateInRoom(room, tile))) errors.push('hazard-out-of-bounds');
  if (hasDuplicateCoordinates(hazards)) errors.push('duplicate-hazard');
  if (hazards.some((tile) => walls.has(coordinateKey(tile)))) errors.push('hazard-wall-conflict');

  if (floorTiles.length === 0) errors.push('empty-floor');
  else {
    const queue = [floorTiles[0]!];
    const visited = new Set([coordinateKey(floorTiles[0]!)]);
    while (queue.length > 0) {
      for (const neighbor of cardinalNeighbors(queue.shift()!)) {
        const key = coordinateKey(neighbor);
        if (floor.has(key) && !visited.has(key)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }
    if (visited.size !== floor.size) errors.push('disconnected-floor');
  }

  const entrance = room.entrance;
  if (
    !entrance ||
    !isCoordinateInRoom(room, entrance.tile) ||
    !onBoundary(room, entrance.tile) ||
    !onDirectionalBoundary(room, entrance.tile, entrance.direction)
  )
    errors.push('invalid-entrance');
  if (entrance) {
    const entranceKey = coordinateKey(entrance.tile);
    if (floor.has(entranceKey)) errors.push('entrance-floor-conflict');
    if (walls.has(entranceKey)) errors.push('entrance-wall-conflict');
    if (hazardLookup.has(entranceKey)) errors.push('entrance-hazard-conflict');
    if (room.exits.some((exit) => exit.enabled && coordinateKey(exit.tile) === entranceKey))
      errors.push('entrance-exit-overlap');
  }

  const enabledExits = room.exits.filter((exit) => exit.enabled);
  if (enabledExits.length < 1 || enabledExits.length > 3) errors.push('invalid-exit-count');
  if (new Set(room.exits.map((exit) => exit.id)).size !== room.exits.length)
    errors.push('duplicate-exit-id');
  if (hasDuplicateCoordinates(room.exits.map((exit) => exit.tile)))
    errors.push('duplicate-exit-coordinate');
  for (const exit of room.exits) {
    const key = coordinateKey(exit.tile);
    if (
      !isCoordinateInRoom(room, exit.tile) ||
      !onBoundary(room, exit.tile) ||
      !onDirectionalBoundary(room, exit.tile, exit.direction) ||
      !floor.has(key) ||
      walls.has(key) ||
      hazardLookup.has(key)
    )
      errors.push('invalid-exit-coordinate');
    if (!validGeneratedExitStructure(exit)) errors.push('invalid-exit-structure');
  }
  for (let left = 0; left < room.exits.length; left += 1) {
    for (let right = left + 1; right < room.exits.length; right += 1) {
      if (manhattan(room.exits[left]!.tile, room.exits[right]!.tile) < 2)
        errors.push('adjacent-exits');
    }
  }

  for (let x = 0; x < room.width; x += 1) {
    for (const tile of [
      { x, y: 0 },
      { x, y: room.height - 1 },
    ]) {
      const key = coordinateKey(tile);
      const opening = room.exits.some((exit) => coordinatesMatch(exit.tile, tile));
      const isEntrance = entrance && coordinatesMatch(entrance.tile, tile);
      if (!opening && !isEntrance && !walls.has(key)) errors.push('invalid-perimeter-wall');
    }
  }
  for (let y = 1; y < room.height - 1; y += 1) {
    for (const tile of [
      { x: 0, y },
      { x: room.width - 1, y },
    ]) {
      const key = coordinateKey(tile);
      const opening = room.exits.some((exit) => coordinatesMatch(exit.tile, tile));
      const isEntrance = entrance && coordinatesMatch(entrance.tile, tile);
      if (!opening && !isEntrance && !walls.has(key)) errors.push('invalid-perimeter-wall');
    }
  }

  const spawnEntries = Object.entries(room.spawnPoints ?? {}).filter(
    (entry): entry is [string, TileCoordinate] => Boolean(entry[1]),
  );
  if (hasDuplicateCoordinates(spawnEntries.map(([, spawn]) => spawn)))
    errors.push('duplicate-spawn');
  for (const [, configuredSpawn] of spawnEntries) {
    if (!isCoordinateInRoom(room, configuredSpawn)) errors.push('spawn-out-of-bounds');
  }
  const spawn = entrance ? room.spawnPoints?.[entrance.direction] : undefined;
  if (
    !spawn ||
    !isCoordinateInRoom(room, spawn) ||
    !floor.has(coordinateKey(spawn)) ||
    walls.has(coordinateKey(spawn)) ||
    hazardLookup.has(coordinateKey(spawn)) ||
    (entrance && coordinatesMatch(entrance.tile, spawn)) ||
    room.exits.some((exit) => coordinatesMatch(exit.tile, spawn) || manhattan(exit.tile, spawn) < 2)
  )
    errors.push('invalid-spawn');

  for (const hazard of hazards) {
    if (!floor.has(coordinateKey(hazard))) errors.push('hazard-off-floor');
    if (entrance && coordinatesMatch(hazard, entrance.tile))
      errors.push('hazard-entrance-conflict');
    if (spawn && manhattan(hazard, spawn) < 2) errors.push('hazard-near-spawn');
    if (room.exits.some((exit) => manhattan(hazard, exit.tile) < 2))
      errors.push('hazard-near-exit');
  }
  if (spawn && enabledExits.some((exit) => !hasSafePath(room, spawn, exit.tile)))
    errors.push('unsafe-exit-path');
  errors.push(...validateEnemySpawns(room, { generated: true, playerSpawn: spawn }));

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
