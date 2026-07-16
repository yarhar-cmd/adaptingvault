import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import type { RoomValidationResult } from '../types/generation';
import {
  coordinateKey,
  coordinatesMatch,
  getFloorLookup,
  getWallLookup,
  isCoordinateInRoom,
} from './roomGeometry';

const cardinalNeighbors = ({ x, y }: TileCoordinate): TileCoordinate[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

function onBoundary(room: RoomDefinition, tile: TileCoordinate): boolean {
  return tile.x === 0 || tile.y === 0 || tile.x === room.width - 1 || tile.y === room.height - 1;
}

function manhattan(left: TileCoordinate, right: TileCoordinate): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function hasSafePath(
  room: RoomDefinition,
  spawn: TileCoordinate,
  destination: TileCoordinate,
): boolean {
  const floor = getFloorLookup(room);
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const blockedEntrance = room.entrance ? coordinateKey(room.entrance.tile) : '';
  const queue = [spawn];
  const visited = new Set([coordinateKey(spawn)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (coordinatesMatch(current, destination)) return true;
    for (const next of cardinalNeighbors(current)) {
      const key = coordinateKey(next);
      if (visited.has(key) || hazards.has(key) || key === blockedEntrance || !floor.has(key))
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
  if (room.width < minWidth || room.width > 21 || room.height < minHeight || room.height > 15) {
    errors.push('dimensions-out-of-bounds');
  }
  const floor = getFloorLookup(room);
  const walls = getWallLookup(room);
  if (room.floorTiles.some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('floor-out-of-bounds');
  if (room.floorTiles.some((tile) => walls.has(coordinateKey(tile))))
    errors.push('floor-wall-conflict');
  if (new Set(room.floorTiles.map(coordinateKey)).size !== room.floorTiles.length)
    errors.push('duplicate-floor');

  if (room.floorTiles.length > 0) {
    const queue = [room.floorTiles[0]!];
    const visited = new Set([coordinateKey(room.floorTiles[0]!)]);
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

  if (!room.entrance || !onBoundary(room, room.entrance.tile)) errors.push('invalid-entrance');
  const enabledExits = room.exits.filter((exit) => exit.enabled);
  if (enabledExits.length < 1 || enabledExits.length > 3) errors.push('invalid-exit-count');
  if (new Set(room.exits.map((exit) => exit.id)).size !== room.exits.length)
    errors.push('duplicate-exit-id');
  if (
    room.exits.some((exit) => !onBoundary(room, exit.tile) || !floor.has(coordinateKey(exit.tile)))
  ) {
    errors.push('invalid-exit-coordinate');
  }
  if (
    room.entrance &&
    room.exits.some((exit) => coordinatesMatch(exit.tile, room.entrance!.tile))
  ) {
    errors.push('entrance-exit-overlap');
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
      const entrance = room.entrance && coordinatesMatch(room.entrance.tile, tile);
      if (!opening && !entrance && !walls.has(key)) errors.push('invalid-perimeter-wall');
    }
  }
  for (let y = 1; y < room.height - 1; y += 1) {
    for (const tile of [
      { x: 0, y },
      { x: room.width - 1, y },
    ]) {
      const key = coordinateKey(tile);
      const opening = room.exits.some((exit) => coordinatesMatch(exit.tile, tile));
      const entrance = room.entrance && coordinatesMatch(room.entrance.tile, tile);
      if (!opening && !entrance && !walls.has(key)) errors.push('invalid-perimeter-wall');
    }
  }
  const spawn = room.entrance ? room.spawnPoints?.[room.entrance.direction] : undefined;
  if (
    !spawn ||
    !floor.has(coordinateKey(spawn)) ||
    room.exits.some((exit) => manhattan(exit.tile, spawn) < 2)
  ) {
    errors.push('invalid-spawn');
  }
  for (const hazard of room.hazards ?? []) {
    if (!floor.has(coordinateKey(hazard))) errors.push('hazard-off-floor');
    if (spawn && manhattan(hazard, spawn) < 2) errors.push('hazard-near-spawn');
    if (room.exits.some((exit) => manhattan(hazard, exit.tile) < 2))
      errors.push('hazard-near-exit');
  }
  if (spawn && enabledExits.some((exit) => !hasSafePath(room, spawn, exit.tile))) {
    errors.push('unsafe-exit-path');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
