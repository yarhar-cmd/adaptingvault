import { describe, expect, it } from 'vitest';
import {
  EVALUATION_ROOM_1_ID,
  evaluationRooms,
  getEvaluationRoom,
} from '../data/rooms/evaluationRooms';
import { placeholderDungeonRoom } from '../data/rooms/placeholderDungeonRoom';
import {
  canCrossRoomExit,
  coordinateKey,
  createRectangularRoom,
  findSafeSpawn,
  generateInteriorFloorTiles,
  generatePerimeterWallTiles,
  getCollapsedEntrance,
  isValidSpawn,
  isWalkableCoordinate,
} from './roomGeometry';

describe('Resonant Ruins room geometry', () => {
  it('places the normal and shortcut doors symmetrically with exactly one separating wall tile', () => {
    const locked = getEvaluationRoom(EVALUATION_ROOM_1_ID, false)!;
    const unlocked = getEvaluationRoom(EVALUATION_ROOM_1_ID, true)!;
    expect(locked.exits.map((exit) => exit.tile)).toEqual([
      { x: 14, y: 4 },
      { x: 14, y: 6 },
    ]);
    expect(locked.exits.map((exit) => exit.enabled)).toEqual([true, false]);
    expect(locked.wallTiles).toContainEqual({ x: 14, y: 5 });
    expect(unlocked.exits.map((exit) => exit.enabled)).toEqual([true, true]);
  });
  it('defines the five requested variable evaluation dimensions', () => {
    expect(evaluationRooms.map(({ width, height }) => [width, height])).toEqual([
      [15, 11],
      [17, 11],
      [15, 13],
      [17, 11],
      [21, 15],
    ]);
  });

  it('generates interior floors and perimeter walls around a doorway opening', () => {
    const floors = generateInteriorFloorTiles(7, 5);
    const walls = generatePerimeterWallTiles(7, 5, [{ x: 6, y: 2 }]);
    const floorKeys = new Set(floors.map(coordinateKey));
    const wallKeys = new Set(walls.map(coordinateKey));

    expect(floors).toHaveLength(15);
    expect(walls).toHaveLength(19);
    expect(floorKeys.has('1:1')).toBe(true);
    expect(floorKeys.has('0:1')).toBe(false);
    expect(wallKeys.has('0:0')).toBe(true);
    expect(wallKeys.has('6:2')).toBe(false);
  });

  it('makes only floor and enabled doorway coordinates walkable', () => {
    const room = createRectangularRoom({
      id: 'geometry-room',
      phase: 'evaluation',
      width: 7,
      height: 5,
      exitEnabled: true,
    });
    expect(isWalkableCoordinate(room, { x: 2, y: 2 })).toBe(true);
    expect(isWalkableCoordinate(room, { x: 0, y: 2 })).toBe(false);
    expect(isWalkableCoordinate(room, { x: 6, y: 2 })).toBe(true);
    expect(isWalkableCoordinate(room, { x: 7, y: 2 })).toBe(false);
    expect(isWalkableCoordinate(placeholderDungeonRoom, { x: 16, y: 6 })).toBe(false);
  });

  it('requires a second eastward step from the doorway before crossing', () => {
    const room = evaluationRooms[0]!;
    const exit = room.exits[0]!;
    expect(
      canCrossRoomExit(room, { row: exit.tile.y, column: exit.tile.x - 1 }, 'right'),
    ).toBeNull();
    expect(canCrossRoomExit(room, { row: exit.tile.y, column: exit.tile.x }, 'right')).toEqual(
      exit,
    );
    expect(canCrossRoomExit(room, { row: exit.tile.y, column: exit.tile.x }, 'left')).toBeNull();
  });

  it('uses valid configured spawns and safely replaces invalid spawns', () => {
    const room = createRectangularRoom({
      id: 'spawn-room',
      phase: 'evaluation',
      width: 7,
      height: 5,
      exitEnabled: true,
    });
    expect(findSafeSpawn(room, 'west')).toEqual({ x: 1, y: 2 });
    expect(isValidSpawn(room, { x: 1, y: 2 }, 'west')).toBe(true);

    const invalidConfigured = {
      ...room,
      spawnPoints: { west: room.exits[0]!.tile },
    };
    const fallback = findSafeSpawn(invalidConfigured, 'west');
    expect(fallback).not.toEqual(room.exits[0]!.tile);
    expect(isValidSpawn(invalidConfigured, fallback, 'west')).toBe(true);
  });

  it('derives a solid collapsed west entrance independently from the spawn', () => {
    const room = evaluationRooms[0]!;
    const collapsed = getCollapsedEntrance(room, 'west');
    expect(collapsed).toEqual({ x: 0, y: 5 });
    expect(collapsed && isWalkableCoordinate(room, collapsed)).toBe(false);
  });
});
