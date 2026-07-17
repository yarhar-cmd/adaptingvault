import type { ExitDirection, RoomDefinition, RoomExit, TileCoordinate } from '../types/rooms';
import {
  GENERATOR_VERSION,
  GENERATED_ROOM_SAVE_SCHEMA_VERSION,
  type GeneratedRoomSave,
  type GenerationRequest,
  type HazardPattern,
} from '../types/generation';
import { coordinateKey, generatePerimeterWallTiles } from './roomGeometry';
import { createGeneratedRoomParameters } from './generatedRoomParameters';
import { validateGeneratedRoom } from './generatedRoomValidator';
import { createSeededRandom, randomInteger, shuffleSeeded, weightedChoice } from './seededRandom';
import { selectGeneratedRatSpawns } from './enemySystem';

const opposite: Record<ExitDirection, ExitDirection> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export function oppositeExitDirection(direction: ExitDirection): ExitDirection {
  return opposite[direction];
}

export function deriveRoomSeed(
  request: Pick<GenerationRequest, 'runSeed' | 'dungeonRoomNumber' | 'chosenExitId'>,
): string {
  return `${request.runSeed}:${request.dungeonRoomNumber}:${request.chosenExitId}:g${GENERATOR_VERSION}`;
}

function boundaryTile(
  direction: ExitDirection,
  offset: number,
  width: number,
  height: number,
): TileCoordinate {
  if (direction === 'north') return { x: offset, y: 0 };
  if (direction === 'south') return { x: offset, y: height - 1 };
  if (direction === 'west') return { x: 0, y: offset };
  return { x: width - 1, y: offset };
}

function inwardTile(direction: ExitDirection, tile: TileCoordinate): TileCoordinate {
  if (direction === 'north') return { x: tile.x, y: tile.y + 1 };
  if (direction === 'south') return { x: tile.x, y: tile.y - 1 };
  if (direction === 'west') return { x: tile.x + 1, y: tile.y };
  return { x: tile.x - 1, y: tile.y };
}

function makeBaseFloor(
  width: number,
  height: number,
  shape: 'rectangle' | 'l-shape',
  variant: number,
): TileCoordinate[] {
  const floor: TileCoordinate[] = [];
  const cutX = Math.max(3, Math.floor((width - 2) * 0.45));
  const cutY = Math.max(3, Math.floor((height - 2) * 0.45));
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let removed = false;
      if (shape === 'l-shape') {
        const right = variant % 2 === 1;
        const bottom = variant >= 2;
        removed =
          (right ? x >= width - 1 - cutX : x <= cutX) &&
          (bottom ? y >= height - 1 - cutY : y <= cutY);
      }
      if (!removed) floor.push({ x, y });
    }
  }
  return floor;
}

function availableOpenings(
  width: number,
  height: number,
  floorLookup: ReadonlySet<string>,
  entrance: TileCoordinate,
): { direction: ExitDirection; tile: TileCoordinate }[] {
  const result: { direction: ExitDirection; tile: TileCoordinate }[] = [];
  for (const direction of ['north', 'south', 'east', 'west'] as const) {
    const maximum = direction === 'north' || direction === 'south' ? width - 2 : height - 2;
    for (let offset = 1; offset <= maximum; offset += 1) {
      const tile = boundaryTile(direction, offset, width, height);
      if (coordinateKey(tile) === coordinateKey(entrance)) continue;
      if (floorLookup.has(coordinateKey(inwardTile(direction, tile))))
        result.push({ direction, tile });
    }
  }
  return result;
}

function manhattan(left: TileCoordinate, right: TileCoordinate): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function generateCandidate(request: GenerationRequest, retry: number): GeneratedRoomSave {
  const roomSeed = deriveRoomSeed(request);
  const random = createSeededRandom(`${roomSeed}:retry:${retry}`);
  const { parameters, reasons } = createGeneratedRoomParameters(
    request.effectiveProfile,
    request.mode,
    request.experiencePreset,
  );
  const shape = weightedChoice(random, [
    ['rectangle', parameters.shapeWeights.rectangle],
    ['l-shape', parameters.shapeWeights.lShape],
  ] as const);
  const minimumWidth =
    shape === 'l-shape' ? Math.max(11, parameters.minWidth) : parameters.minWidth;
  const minimumHeight =
    shape === 'l-shape' ? Math.max(11, parameters.minHeight) : parameters.minHeight;
  const width = randomInteger(random, minimumWidth, parameters.maxWidth);
  const height = randomInteger(random, minimumHeight, parameters.maxHeight);
  const variant = randomInteger(random, 0, 3);
  const entranceOffset =
    request.entranceDirection === 'north' || request.entranceDirection === 'south'
      ? Math.floor(width / 2)
      : Math.floor(height / 2);
  const entranceTile = boundaryTile(request.entranceDirection, entranceOffset, width, height);
  const floorTiles = makeBaseFloor(width, height, shape, variant);
  const floorLookup = new Set(floorTiles.map(coordinateKey));
  const spawn = inwardTile(request.entranceDirection, entranceTile);
  if (!floorLookup.has(coordinateKey(spawn))) {
    floorTiles.push(spawn);
    floorLookup.add(coordinateKey(spawn));
  }
  const desiredExitCount = weightedChoice(random, [
    [1, parameters.exitCountWeights[1]],
    [2, parameters.exitCountWeights[2]],
    [3, parameters.exitCountWeights[3]],
  ] as const);
  const choices = shuffleSeeded(
    random,
    availableOpenings(width, height, floorLookup, entranceTile),
  );
  const selected: typeof choices = [];
  for (const choice of choices) {
    if (selected.every((item) => manhattan(item.tile, choice.tile) >= 2)) selected.push(choice);
    if (selected.length === desiredExitCount) break;
  }
  for (const choice of selected) floorTiles.push(choice.tile);
  const exits: RoomExit[] = selected.map((choice, index) => ({
    id: `dungeon-${request.dungeonRoomNumber}-exit-${index + 1}-${choice.direction}`,
    direction: choice.direction,
    tile: choice.tile,
    kind: 'standard',
    condition: { type: 'enemies-defeated' },
    enabled: true,
    destination: { type: 'next-generated-room' },
  }));
  const hazardPattern = weightedChoice<HazardPattern>(random, [
    ['scattered', parameters.hazardPatternWeights.scattered],
    ['clustered', parameters.hazardPatternWeights.clustered],
  ]);
  const hazardCount = randomInteger(
    random,
    parameters.hazardCountRange.min,
    parameters.hazardCountRange.max,
  );
  const eligible = shuffleSeeded(
    random,
    floorTiles.filter(
      (tile) =>
        manhattan(tile, spawn) >= 2 && exits.every((exit) => manhattan(tile, exit.tile) >= 2),
    ),
  );
  const hazards: TileCoordinate[] = [];
  for (const tile of eligible) {
    if (hazards.length >= hazardCount) break;
    if (hazardPattern === 'scattered' && hazards.some((item) => manhattan(item, tile) < 2))
      continue;
    if (
      hazardPattern === 'clustered' &&
      hazards.length > 0 &&
      random() < 0.65 &&
      hazards.every((item) => manhattan(item, tile) > 1)
    )
      continue;
    hazards.push(tile);
  }
  const roomSnapshot: RoomDefinition = {
    id: `generated-dungeon-room-${request.dungeonRoomNumber}`,
    phase: 'dungeon',
    width,
    height,
    shape,
    floorTiles,
    wallTiles: generatePerimeterWallTiles(width, height, [
      ...selected.map((item) => item.tile),
      entranceTile,
    ]),
    exits,
    entrance: { direction: request.entranceDirection, tile: entranceTile },
    spawnPoints: { [request.entranceDirection]: spawn },
    hazards,
  };
  const enemySelection = selectGeneratedRatSpawns(roomSnapshot, {
    roomSeed,
    preset: request.experiencePreset,
    profile: request.effectiveProfile,
    mode: request.mode,
    playerSpawn: spawn,
  });
  roomSnapshot.enemySpawns = enemySelection.spawns;
  const validation = validateGeneratedRoom(roomSnapshot);
  return {
    schemaVersion: GENERATED_ROOM_SAVE_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    runSeed: request.runSeed,
    roomSeed,
    dungeonRoomNumber: request.dungeonRoomNumber,
    adaptiveInput: parameters,
    roomSnapshot,
    details: {
      roomSeed,
      generatorVersion: GENERATOR_VERSION,
      shape,
      entranceDirection: request.entranceDirection,
      hazardPattern,
      mode: request.mode,
      retryCount: retry,
      validationErrors: validation.errors,
      reasons,
      enemyCountPlan: enemySelection.plan,
    },
  };
}

function createFallback(request: GenerationRequest, errors: string[]): GeneratedRoomSave {
  const roomSeed = deriveRoomSeed(request);
  const width = 11;
  const height = 9;
  const entranceTile = boundaryTile(
    request.entranceDirection,
    request.entranceDirection === 'north' || request.entranceDirection === 'south' ? 5 : 4,
    width,
    height,
  );
  const spawn = inwardTile(request.entranceDirection, entranceTile);
  const exitDirection = oppositeExitDirection(request.entranceDirection);
  const exitTile = boundaryTile(
    exitDirection,
    exitDirection === 'north' || exitDirection === 'south' ? 5 : 4,
    width,
    height,
  );
  const floorTiles = makeBaseFloor(width, height, 'rectangle', 0).concat(exitTile);
  const exit: RoomExit = {
    id: `dungeon-${request.dungeonRoomNumber}-fallback-exit`,
    direction: exitDirection,
    tile: exitTile,
    kind: 'standard',
    condition: { type: 'enemies-defeated' },
    enabled: true,
    destination: { type: 'next-generated-room' },
  };
  const { parameters, reasons } = createGeneratedRoomParameters(
    request.effectiveProfile,
    request.mode,
    request.experiencePreset,
  );
  const roomSnapshot: RoomDefinition = {
    id: `generated-dungeon-room-${request.dungeonRoomNumber}`,
    phase: 'dungeon',
    width,
    height,
    shape: 'rectangle',
    floorTiles,
    wallTiles: generatePerimeterWallTiles(width, height, [entranceTile, exitTile]),
    exits: [exit],
    entrance: { direction: request.entranceDirection, tile: entranceTile },
    spawnPoints: { [request.entranceDirection]: spawn },
    hazards: [],
  };
  const enemySelection = selectGeneratedRatSpawns(roomSnapshot, {
    roomSeed,
    preset: request.experiencePreset,
    profile: request.effectiveProfile,
    mode: request.mode,
    playerSpawn: spawn,
  });
  roomSnapshot.enemySpawns = enemySelection.spawns;
  return {
    schemaVersion: GENERATED_ROOM_SAVE_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    runSeed: request.runSeed,
    roomSeed,
    dungeonRoomNumber: request.dungeonRoomNumber,
    adaptiveInput: parameters,
    roomSnapshot,
    details: {
      roomSeed,
      generatorVersion: GENERATOR_VERSION,
      shape: 'rectangle',
      entranceDirection: request.entranceDirection,
      hazardPattern: 'scattered',
      mode: 'fallback',
      retryCount: 20,
      validationErrors: errors,
      reasons: [...reasons, 'Known-safe fallback after 20 retries'],
      enemyCountPlan: enemySelection.plan,
    },
  };
}

export function generateDungeonRoom(
  request: GenerationRequest,
  validator: typeof validateGeneratedRoom = validateGeneratedRoom,
): GeneratedRoomSave {
  let errors: string[] = [];
  for (let retry = 0; retry < 20; retry += 1) {
    const candidate = generateCandidate(request, retry);
    const validation = validator(candidate.roomSnapshot);
    if (validation.valid)
      return { ...candidate, details: { ...candidate.details, validationErrors: [] } };
    errors = validation.errors;
  }
  const fallback = createFallback(request, errors);
  if (import.meta.env.DEV) {
    console.warn('Resonant Ruins generation fallback', {
      seed: fallback.roomSeed,
      retryCount: 20,
      validationErrors: errors,
      fallback: true,
    });
  }
  return fallback;
}
