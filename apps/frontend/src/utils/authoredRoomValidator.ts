import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import {
  coordinateKey,
  coordinatesMatch,
  getFloorLookup,
  getWallLookup,
  isCoordinateInRoom,
} from './roomGeometry';
import { hasSafePath, validateEnemySpawns } from './generatedRoomValidator';
import { EVALUATION_ROOM_4_ID, EVALUATION_ROOM_5_ID } from '../data/rooms/evaluationRooms';

export interface AuthoredRoomValidationResult {
  valid: boolean;
  errors: string[];
}

function duplicateCoordinates(items: TileCoordinate[]): boolean {
  return new Set(items.map(coordinateKey)).size !== items.length;
}

function directionalBoundary(room: RoomDefinition, tile: TileCoordinate, direction: string) {
  if (direction === 'north') return tile.y === 0;
  if (direction === 'south') return tile.y === room.height - 1;
  if (direction === 'west') return tile.x === 0;
  return tile.x === room.width - 1;
}

function isFloorConnected(room: RoomDefinition): boolean {
  const floor = getFloorLookup(room);
  const first = room.floorTiles[0];
  if (!first) return false;
  const visited = new Set([coordinateKey(first)]);
  const queue = [first];
  let index = 0;
  while (index < queue.length) {
    const current = queue[index++]!;
    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]) {
      const key = coordinateKey(next);
      if (!visited.has(key) && floor.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited.size === floor.size;
}

export function validateAuthoredRoom(
  room: RoomDefinition,
  officialRooms: readonly RoomDefinition[] = [],
): AuthoredRoomValidationResult {
  const errors: string[] = [];
  if (
    room.phase !== 'evaluation' ||
    !Number.isSafeInteger(room.width) ||
    !Number.isSafeInteger(room.height) ||
    room.width < 9 ||
    room.width > 21 ||
    room.height < 9 ||
    room.height > 15
  )
    errors.push('Room dimensions must be integers within 9–21 by 9–15.');
  const floor = getFloorLookup(room);
  const walls = getWallLookup(room);
  if (room.floorTiles.some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('Every floor tile must be inside the room.');
  if ((room.wallTiles ?? []).some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('Every wall tile must be inside the room.');
  if (duplicateCoordinates(room.floorTiles)) errors.push('Floor coordinates must be unique.');
  if (duplicateCoordinates(room.wallTiles ?? [])) errors.push('Wall coordinates must be unique.');
  if (room.floorTiles.some((tile) => walls.has(coordinateKey(tile))))
    errors.push('Floor and wall tiles cannot overlap.');
  if (!isFloorConnected(room)) errors.push('All floor tiles must form one connected area.');
  const spawn = room.spawnPoints?.west;
  if (!spawn || !floor.has(coordinateKey(spawn)) || walls.has(coordinateKey(spawn)))
    errors.push('A valid west player spawn is required on walkable floor.');
  for (const exit of room.exits) {
    if (
      !isCoordinateInRoom(room, exit.tile) ||
      !directionalBoundary(room, exit.tile, exit.direction) ||
      !floor.has(coordinateKey(exit.tile)) ||
      walls.has(coordinateKey(exit.tile))
    )
      errors.push(`Exit ${exit.id} must be on its matching walkable boundary.`);
    if (exit.kind === 'shortcut' && exit.condition.type !== 'always')
      errors.push('Shortcut exits must use the always condition.');
    if (spawn && !hasSafePath(room, spawn, exit.tile))
      errors.push(`Exit ${exit.id} must be structurally reachable from the spawn.`);
  }
  if (new Set(room.exits.map((exit) => exit.id)).size !== room.exits.length)
    errors.push('Exit IDs must be unique.');
  if (duplicateCoordinates(room.exits.map((exit) => exit.tile)))
    errors.push('Exit coordinates must be unique.');
  if (duplicateCoordinates(room.hazards ?? [])) errors.push('Hazard coordinates must be unique.');
  for (const hazard of room.hazards ?? []) {
    if (!floor.has(coordinateKey(hazard)) || walls.has(coordinateKey(hazard)))
      errors.push('Hazards must be on walkable floor.');
    if (spawn && coordinatesMatch(spawn, hazard)) errors.push('Hazards cannot overlap the spawn.');
    if (room.exits.some((exit) => coordinatesMatch(exit.tile, hazard)))
      errors.push('Hazards cannot overlap exits.');
  }
  errors.push(...validateEnemySpawns(room).map((error) => `Enemy spawn: ${error}.`));
  if (
    (room.id === EVALUATION_ROOM_4_ID || room.id === EVALUATION_ROOM_5_ID) &&
    (room.enemySpawns?.length ?? 0) < 3
  )
    errors.push('Chambers 4 and 5 require at least three ordered Rat spawns.');
  if (room.id === EVALUATION_ROOM_4_ID && (room.hazards?.length ?? 0) > 0)
    errors.push('Chamber 4 must remain a clear combat-focused room without rune hazards.');
  if (room.id === EVALUATION_ROOM_5_ID) {
    if ((room.hazards?.length ?? 0) < 1)
      errors.push('Chamber 5 requires at least one rune hazard.');
    const chamber4 = officialRooms.find((candidate) => candidate.id === EVALUATION_ROOM_4_ID);
    if (chamber4 && room.width * room.height <= chamber4.width * chamber4.height)
      errors.push('Chamber 5 must be larger than Chamber 4.');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
