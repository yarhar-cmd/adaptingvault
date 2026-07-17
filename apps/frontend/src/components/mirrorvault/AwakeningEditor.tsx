import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { evaluationRooms } from '../../data/rooms/evaluationRooms';
import { useCharacterControls } from '../../hooks/useCharacterControls';
import { useEnemyClock } from '../../hooks/useEnemyClock';
import {
  cloneRoom,
  loadEditorDrafts,
  saveEditorDrafts,
  type EditorDraftEnvelope,
} from '../../services/editorDraftStorage';
import type { CardinalDirection } from '../../types/player';
import type { RoomDefinition, TileCoordinate } from '../../types/rooms';
import { createRoomEnemyState, livingRats } from '../../utils/enemySystem';
import { createGameplayState, gameplayReducer } from '../../utils/gameplayState';
import {
  coordinateKey,
  coordinateToGridPosition,
  canCrossRoomExit,
  findSafeSpawn,
  roomBounds,
} from '../../utils/roomGeometry';
import { validateAuthoredRoom } from '../../utils/authoredRoomValidator';
import { SecondaryButton } from '../common/Buttons';
import { DungeonGrid } from './DungeonGrid';

type EditorTool = 'floor' | 'wall' | 'spawn' | 'exit' | 'shortcut' | 'hazard' | 'rat' | 'erase';
const tools: Array<{ id: EditorTool; label: string }> = [
  { id: 'floor', label: 'Floor' },
  { id: 'wall', label: 'Wall / Void' },
  { id: 'spawn', label: 'Spawn' },
  { id: 'exit', label: 'Exit' },
  { id: 'shortcut', label: 'Shortcut Exit' },
  { id: 'hazard', label: 'Hazard' },
  { id: 'rat', label: 'Rat Spawn' },
  { id: 'erase', label: 'Erase' },
];

function matches(left: TileCoordinate, right: TileCoordinate) {
  return left.x === right.x && left.y === right.y;
}
function without(items: TileCoordinate[] | undefined, tile: TileCoordinate) {
  return (items ?? []).filter((item) => !matches(item, tile));
}
function addUnique(items: TileCoordinate[] | undefined, tile: TileCoordinate) {
  return (items ?? []).some((item) => matches(item, tile))
    ? [...(items ?? [])]
    : [...(items ?? []), tile];
}
function renumberSpawns(room: RoomDefinition) {
  room.enemySpawns = (room.enemySpawns ?? []).map((spawn, index) => ({
    ...spawn,
    order: index + 1,
    id: `${room.id}-rat-${index + 1}`,
  }));
}
function exitDirection(room: RoomDefinition, tile: TileCoordinate) {
  if (tile.y === 0) return 'north' as const;
  if (tile.y === room.height - 1) return 'south' as const;
  if (tile.x === 0) return 'west' as const;
  if (tile.x === room.width - 1) return 'east' as const;
  return null;
}
function paint(room: RoomDefinition, tile: TileCoordinate, tool: EditorTool): RoomDefinition {
  const next = cloneRoom(room);
  if (tool === 'erase') {
    next.floorTiles = without(next.floorTiles, tile);
    next.wallTiles = without(next.wallTiles, tile);
    next.hazards = without(next.hazards, tile);
    next.exits = next.exits.filter((exit) => !matches(exit.tile, tile));
    next.enemySpawns = (next.enemySpawns ?? [])
      .filter((spawn) => !matches(spawn.tile, tile))
      .map((spawn, index) => ({ ...spawn, order: index + 1, id: `${next.id}-rat-${index + 1}` }));
    if (next.spawnPoints?.west && matches(next.spawnPoints.west, tile))
      delete next.spawnPoints.west;
    return next;
  }
  if (tool === 'floor') {
    next.floorTiles = addUnique(next.floorTiles, tile);
    next.wallTiles = without(next.wallTiles, tile);
  }
  if (tool === 'wall') {
    next.wallTiles = addUnique(next.wallTiles, tile);
    next.floorTiles = without(next.floorTiles, tile);
    next.hazards = without(next.hazards, tile);
    next.enemySpawns = (next.enemySpawns ?? []).filter((spawn) => !matches(spawn.tile, tile));
    renumberSpawns(next);
  }
  if (tool === 'spawn') {
    next.spawnPoints = { ...next.spawnPoints, west: tile };
    next.floorTiles = addUnique(next.floorTiles, tile);
    next.wallTiles = without(next.wallTiles, tile);
  }
  if (tool === 'hazard') {
    next.hazards = addUnique(next.hazards, tile);
    next.floorTiles = addUnique(next.floorTiles, tile);
    next.wallTiles = without(next.wallTiles, tile);
  }
  if (tool === 'rat' && !(next.enemySpawns ?? []).some((spawn) => matches(spawn.tile, tile))) {
    const order = (next.enemySpawns?.length ?? 0) + 1;
    next.enemySpawns = [
      ...(next.enemySpawns ?? []),
      {
        id: `${next.id}-rat-${order}`,
        type: 'rat',
        tile,
        order,
        source: 'authored',
        reason: `Authored Rat Spawn ${order}`,
      },
    ];
    next.floorTiles = addUnique(next.floorTiles, tile);
    next.wallTiles = without(next.wallTiles, tile);
  }
  if (tool === 'exit' || tool === 'shortcut') {
    const direction = exitDirection(next, tile);
    if (!direction) return next;
    const kind = tool === 'shortcut' ? 'shortcut' : 'standard';
    next.exits = [
      ...next.exits.filter((exit) => exit.kind !== kind),
      {
        id: `${next.id}-${kind}-exit`,
        direction,
        tile,
        kind,
        condition:
          kind === 'shortcut' || !['evaluation-room-04', 'evaluation-room-05'].includes(next.id)
            ? { type: 'always' }
            : { type: 'enemies-defeated' },
        enabled: kind === 'standard',
      },
    ];
    next.floorTiles = addUnique(next.floorTiles, tile);
    next.wallTiles = without(next.wallTiles, tile);
  }
  return next;
}

function resizeRoom(room: RoomDefinition, width: number, height: number): RoomDefinition {
  const inside = (tile: TileCoordinate) =>
    tile.x >= 0 && tile.x < width && tile.y >= 0 && tile.y < height;
  return {
    ...cloneRoom(room),
    width,
    height,
    floorTiles: room.floorTiles.filter(inside),
    wallTiles: (room.wallTiles ?? []).filter(inside),
    hazards: (room.hazards ?? []).filter(inside),
    exits: room.exits.filter((exit) => inside(exit.tile)),
    enemySpawns: (room.enemySpawns ?? [])
      .filter((spawn) => inside(spawn.tile))
      .map((spawn, index) => ({ ...spawn, order: index + 1, id: `${room.id}-rat-${index + 1}` })),
    spawnPoints:
      room.spawnPoints?.west && inside(room.spawnPoints.west)
        ? { west: room.spawnPoints.west }
        : {},
  };
}

export function AwakeningEditor() {
  const [loaded] = useState(() => loadEditorDrafts(evaluationRooms));
  const [drafts, setDrafts] = useState<EditorDraftEnvelope>(loaded.drafts);
  const [selectedId, setSelectedId] = useState(evaluationRooms[0]!.id);
  const [tool, setTool] = useState<EditorTool>('floor');
  const [validation, setValidation] = useState<ReturnType<typeof validateAuthoredRoom> | null>(
    null,
  );
  const [message, setMessage] = useState(
    loaded.recovered ? 'Corrupt editor drafts were reset.' : '',
  );
  const [preview, setPreview] = useState<RoomDefinition | null>(null);
  const room = drafts.rooms[selectedId]!;
  const official = evaluationRooms.find((candidate) => candidate.id === selectedId)!;

  useEffect(() => {
    saveEditorDrafts(drafts);
  }, [drafts]);

  function update(next: RoomDefinition) {
    setDrafts((current) => ({ ...current, rooms: { ...current.rooms, [selectedId]: next } }));
    setValidation(null);
    setMessage('Editor Draft');
  }
  function resize(dimension: 'width' | 'height', value: number) {
    const width = dimension === 'width' ? value : room.width;
    const height = dimension === 'height' ? value : room.height;
    const removesContent = [
      ...room.floorTiles,
      ...(room.wallTiles ?? []),
      ...(room.hazards ?? []),
      ...room.exits.map((exit) => exit.tile),
      ...(room.enemySpawns ?? []).map((spawn) => spawn.tile),
      ...(room.spawnPoints?.west ? [room.spawnPoints.west] : []),
    ].some((tile) => tile.x >= width || tile.y >= height);
    if (
      removesContent &&
      !window.confirm('Resize will remove out-of-bounds draft content. Continue?')
    )
      return;
    update(resizeRoom(room, width, height));
  }
  const ratOrders = new Map(
    (room.enemySpawns ?? []).map((spawn) => [coordinateKey(spawn.tile), spawn.order]),
  );

  if (preview) return <EditorPreview room={preview} onExit={() => setPreview(null)} />;

  return (
    <section className="awakening-editor" aria-labelledby="awakening-editor-title">
      <p className="eyebrow">Editor Draft</p>
      <h3 id="awakening-editor-title">Awakening Chamber Editor</h3>
      <label>
        Awakening Chamber
        <select
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setValidation(null);
          }}
        >
          {evaluationRooms.map((candidate, index) => (
            <option key={candidate.id} value={candidate.id}>
              {index + 1}
            </option>
          ))}
        </select>
      </label>
      <div className="editor-dimensions">
        <label>
          Room width
          <input
            aria-label="Room width"
            type="number"
            min="9"
            max="21"
            value={room.width}
            onChange={(event) => resize('width', Number(event.target.value))}
          />
        </label>
        <label>
          Room height
          <input
            aria-label="Room height"
            type="number"
            min="9"
            max="15"
            value={room.height}
            onChange={(event) => resize('height', Number(event.target.value))}
          />
        </label>
      </div>
      <fieldset className="editor-tools">
        <legend>Paint tool</legend>
        {tools.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={tool === candidate.id}
            onClick={() => setTool(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </fieldset>
      <p className="editor-legend">
        Floor · Wall/Void · Spawn · Exit · Shortcut · Hazard · numbered Rat Spawn · Erase
      </p>
      <div
        className="editor-grid"
        style={{ '--editor-columns': room.width, '--editor-rows': room.height } as CSSProperties}
      >
        {Array.from({ length: room.width * room.height }, (_, index) => {
          const tile = { x: index % room.width, y: Math.floor(index / room.width) };
          const key = coordinateKey(tile);
          const ratOrder = ratOrders.get(key);
          const kind =
            room.spawnPoints?.west && matches(room.spawnPoints.west, tile)
              ? 'spawn'
              : (room.exits.find((exit) => matches(exit.tile, tile))?.kind ??
                ((room.hazards ?? []).some((hazard) => matches(hazard, tile))
                  ? 'hazard'
                  : ratOrder
                    ? 'rat'
                    : (room.wallTiles ?? []).some((wall) => matches(wall, tile))
                      ? 'wall'
                      : room.floorTiles.some((floor) => matches(floor, tile))
                        ? 'floor'
                        : 'void'));
          return (
            <button
              key={key}
              type="button"
              className={`editor-tile editor-tile--${kind}`}
              aria-label={`Tile ${tile.x}, ${tile.y}: ${kind}${ratOrder ? ` ${ratOrder}` : ''}`}
              onClick={() => update(paint(room, tile, tool))}
            >
              {ratOrder ?? ''}
            </button>
          );
        })}
      </div>
      <div className="editor-actions">
        <SecondaryButton
          onClick={() => {
            const result = validateAuthoredRoom(room, evaluationRooms);
            setValidation(result);
            setMessage(result.valid ? 'Room is valid.' : 'Room has validation errors.');
          }}
        >
          Validate Room
        </SecondaryButton>
        <SecondaryButton
          onClick={() => {
            if (
              JSON.stringify(room) !== JSON.stringify(official) &&
              !window.confirm('Reset this Editor Draft to official source?')
            )
              return;
            update(cloneRoom(official));
            setMessage('Draft reset to official room.');
          }}
        >
          Reset Draft
        </SecondaryButton>
        <SecondaryButton
          disabled={!validation?.valid}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(JSON.stringify(room, null, 2));
              setMessage('Room JSON copied.');
            } catch {
              setMessage('Room JSON could not be copied.');
            }
          }}
        >
          Copy Room JSON
        </SecondaryButton>
        <SecondaryButton disabled={!validation?.valid} onClick={() => setPreview(cloneRoom(room))}>
          Preview Room
        </SecondaryButton>
      </div>
      {message && <p role="status">{message}</p>}
      {validation && !validation.valid && (
        <ul className="editor-errors" aria-label="Room validation errors">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditorPreview({ room, onExit }: { room: RoomDefinition; onExit: () => void }) {
  const sequence = useRef(0);
  const [gameplay, dispatch] = useReducer(gameplayReducer, undefined, () => {
    const now = Date.now();
    return gameplayReducer(createGameplayState(6), {
      type: 'start-run',
      maximumHealth: 6,
      startedAt: now,
      runId: 'editor-preview',
      runSeed: 'editor-preview',
      roomOrder: evaluationRooms.map((candidate) => candidate.id),
      currentRoomId: room.id,
      experiencePreset: 'seasoned-adventurer',
      spawn: coordinateToGridPosition(findSafeSpawn(room, 'west')),
      enemies: createRoomEnemyState(room, 'seasoned-adventurer', now),
    });
  });
  useEnemyClock({
    enabled: gameplay.status === 'active' && gameplay.enemies.rats.length > 0,
    room,
    onTick: (timestamp) => dispatch({ type: 'enemy-tick', timestamp, room }),
  });
  const living = livingRats(gameplay.enemies).length;
  const controls = useCharacterControls({
    enabled: gameplay.status === 'active',
    onMove: (direction, trigger) => {
      if (canCrossRoomExit(room, gameplay.player.position, direction, living)) {
        onExit();
        return;
      }
      dispatch({
        type: 'move',
        direction,
        trigger,
        id: `preview-move-${sequence.current++}`,
        timestamp: Date.now(),
        room,
      });
    },
    onTurn: (direction: CardinalDirection, trigger) =>
      dispatch({ type: 'turn', direction, trigger, timestamp: Date.now() }),
    onAttack: () => {
      dispatch({
        type: 'attack',
        id: `preview-attack-${sequence.current++}`,
        timestamp: Date.now(),
        room,
      });
      return true;
    },
    onShieldChange: (isShielding) =>
      dispatch({ type: 'shield', isShielding, timestamp: Date.now() }),
  });
  return (
    <section className="editor-preview" aria-label="Preview Mode">
      <h3>Preview Mode</h3>
      <SecondaryButton onClick={onExit}>Exit Preview</SecondaryButton>
      <DungeonGrid
        bounds={roomBounds(room)}
        hazards={(room.hazards ?? []).map(coordinateToGridPosition)}
        room={room}
        player={gameplay.player}
        status={gameplay.status}
        isInvulnerable={gameplay.invulnerability.expiresAt !== null}
        blockedMove={gameplay.blockedMove}
        lastAttack={gameplay.lastAttack}
        lastDamage={gameplay.lastDamage}
        lastAvoidedDamage={gameplay.lastAvoidedDamage}
        announcement={gameplay.announcement}
        controlsDisabled={gameplay.status !== 'active'}
        onMove={controls.move}
        onAttack={controls.attack}
        onShieldChange={controls.setPointerShielding}
        enemies={gameplay.enemies}
        exitsSealed={living > 0}
      />
    </section>
  );
}
