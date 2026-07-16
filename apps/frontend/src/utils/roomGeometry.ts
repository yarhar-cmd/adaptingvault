import type { CardinalDirection, GridPosition, RoomBounds } from '../types/player';
import type { ExitDirection, RoomDefinition, RoomExit, TileCoordinate } from '../types/rooms';

export function coordinateKey({ x, y }: TileCoordinate): string {
  return `${x}:${y}`;
}

export function gridPositionToCoordinate({ row, column }: GridPosition): TileCoordinate {
  return { x: column, y: row };
}

export function coordinateToGridPosition({ x, y }: TileCoordinate): GridPosition {
  return { row: y, column: x };
}

export function roomBounds(room: RoomDefinition): RoomBounds {
  return { rows: room.height, columns: room.width };
}

export function isCoordinateInRoom(room: RoomDefinition, coordinate: TileCoordinate): boolean {
  return (
    coordinate.x >= 0 &&
    coordinate.x < room.width &&
    coordinate.y >= 0 &&
    coordinate.y < room.height
  );
}

export function coordinatesMatch(left: TileCoordinate, right: TileCoordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

export function generateInteriorFloorTiles(width: number, height: number): TileCoordinate[] {
  const floorTiles: TileCoordinate[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) floorTiles.push({ x, y });
  }
  return floorTiles;
}

export function generatePerimeterWallTiles(
  width: number,
  height: number,
  openings: readonly TileCoordinate[] = [],
): TileCoordinate[] {
  const openingKeys = new Set(openings.map(coordinateKey));
  const wallTiles: TileCoordinate[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isPerimeter = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (isPerimeter && !openingKeys.has(coordinateKey({ x, y }))) wallTiles.push({ x, y });
    }
  }
  return wallTiles;
}

export function createRectangularRoom(input: {
  id: string;
  phase: RoomDefinition['phase'];
  width: number;
  height: number;
  exitEnabled: boolean;
  hazards?: TileCoordinate[];
  exits?: RoomExit[];
}): RoomDefinition {
  const doorway = { x: input.width - 1, y: Math.floor(input.height / 2) };
  const exit: RoomExit = {
    id: `${input.id}-east-exit`,
    direction: 'east',
    tile: doorway,
    kind: 'standard',
    condition: { type: 'always' },
    enabled: input.exitEnabled,
  };
  const exits = input.exits ?? [exit];
  const openings = exits.map((item) => item.tile);

  return {
    id: input.id,
    phase: input.phase,
    width: input.width,
    height: input.height,
    floorTiles: [...generateInteriorFloorTiles(input.width, input.height), ...openings],
    wallTiles: generatePerimeterWallTiles(input.width, input.height, openings),
    exits,
    spawnPoints: { west: { x: 1, y: Math.floor(input.height / 2) } },
    hazards: input.hazards ?? [],
  };
}

export function getFloorLookup(room: RoomDefinition): ReadonlySet<string> {
  return new Set(room.floorTiles.map(coordinateKey));
}

export function getWallLookup(room: RoomDefinition): ReadonlySet<string> {
  return new Set((room.wallTiles ?? []).map(coordinateKey));
}

export function findExitAt(room: RoomDefinition, coordinate: TileCoordinate): RoomExit | null {
  return room.exits.find((exit) => coordinatesMatch(exit.tile, coordinate)) ?? null;
}

export function isExitConditionMet(exit: RoomExit): boolean {
  return exit.enabled && exit.condition.type === 'always';
}

export function isWalkableCoordinate(room: RoomDefinition, coordinate: TileCoordinate): boolean {
  if (!isCoordinateInRoom(room, coordinate)) return false;
  if (!getFloorLookup(room).has(coordinateKey(coordinate))) return false;
  if (getWallLookup(room).has(coordinateKey(coordinate))) return false;
  const exit = findExitAt(room, coordinate);
  return !exit || isExitConditionMet(exit);
}

export function getCollapsedEntrance(
  room: RoomDefinition,
  enteredFrom: ExitDirection | null,
): TileCoordinate | null {
  if (room.entrance) return room.entrance.tile;
  if (!enteredFrom) return null;
  const configured = room.spawnPoints?.[enteredFrom];
  if (enteredFrom === 'north') return { x: configured?.x ?? Math.floor(room.width / 2), y: 0 };
  if (enteredFrom === 'south')
    return { x: configured?.x ?? Math.floor(room.width / 2), y: room.height - 1 };
  if (enteredFrom === 'east')
    return { x: room.width - 1, y: configured?.y ?? Math.floor(room.height / 2) };
  const spawn = room.spawnPoints?.west;
  return { x: 0, y: spawn?.y ?? Math.floor(room.height / 2) };
}

function isAdjacent(left: TileCoordinate, right: TileCoordinate): boolean {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
}

export function isValidSpawn(
  room: RoomDefinition,
  spawn: TileCoordinate,
  enteredFrom: ExitDirection,
): boolean {
  const collapsedEntrance = getCollapsedEntrance(room, enteredFrom);
  return (
    isWalkableCoordinate(room, spawn) &&
    !(room.hazards ?? []).some((hazard) => coordinatesMatch(hazard, spawn)) &&
    !room.exits.some(
      (exit) => coordinatesMatch(exit.tile, spawn) || isAdjacent(exit.tile, spawn),
    ) &&
    (!collapsedEntrance || !coordinatesMatch(collapsedEntrance, spawn))
  );
}

export function findSafeSpawn(
  room: RoomDefinition,
  enteredFrom: ExitDirection = 'west',
): TileCoordinate {
  const configured = room.spawnPoints?.[enteredFrom];
  if (configured && isValidSpawn(room, configured, enteredFrom)) return configured;

  const fallback = room.floorTiles.find((tile) => isValidSpawn(room, tile, enteredFrom));
  if (fallback) return fallback;
  throw new Error(`Room ${room.id} has no safe spawn tile.`);
}

export function cardinalToExitDirection(direction: CardinalDirection): ExitDirection {
  const directions: Record<CardinalDirection, ExitDirection> = {
    up: 'north',
    down: 'south',
    left: 'west',
    right: 'east',
  };
  return directions[direction];
}

export function canCrossRoomExit(
  room: RoomDefinition,
  position: GridPosition,
  direction: CardinalDirection,
): RoomExit | null {
  const exitDirection = cardinalToExitDirection(direction);
  return (
    room.exits.find(
      (exit) =>
        exit.direction === exitDirection &&
        isExitConditionMet(exit) &&
        coordinatesMatch(exit.tile, gridPositionToCoordinate(position)),
    ) ?? null
  );
}
