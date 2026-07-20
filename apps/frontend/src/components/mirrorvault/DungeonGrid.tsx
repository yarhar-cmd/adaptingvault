import {
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type {
  AttackAction,
  CardinalDirection,
  MoveResult,
  PlayerState,
  RoomBounds,
} from '../../types/player';
import type { AvoidedDamageEvent, DamageEvent, GameplayStatus } from '../../utils/gameplayState';
import type { RoomDefinition, TileCoordinate } from '../../types/rooms';
import type { EnemyRoomState } from '../../types/enemies';
import { RAT_COMBAT_CONFIG } from '../../config/combat';
import { positionsMatch } from '../../utils/playerActions';
import { coordinateKey, findExitAt, getFloorLookup, getWallLookup } from '../../utils/roomGeometry';

const legacyEnemies = new Set(['2-3', '3-5']);
const MAX_ROOM_COLUMNS = 21;
const MAX_ROOM_ROWS = 15;

export function DungeonGrid({
  bounds,
  hazards,
  player,
  status,
  isInvulnerable,
  blockedMove,
  lastAttack,
  lastDamage,
  lastAvoidedDamage,
  announcement,
  controlsDisabled,
  room,
  collapsedEntrance,
  hidePlayer = false,
  onMove,
  onAttack,
  onShieldChange,
  enemies,
  exitsSealed = false,
}: {
  bounds: RoomBounds;
  hazards: readonly { row: number; column: number }[];
  player: PlayerState;
  status: GameplayStatus;
  isInvulnerable: boolean;
  blockedMove: MoveResult | null;
  lastAttack: AttackAction | null;
  lastDamage: DamageEvent | null;
  lastAvoidedDamage: AvoidedDamageEvent | null;
  announcement: string;
  controlsDisabled: boolean;
  room?: RoomDefinition;
  collapsedEntrance?: TileCoordinate | null;
  hidePlayer?: boolean;
  onMove: (direction: CardinalDirection) => void;
  onAttack: () => boolean;
  onShieldChange: (isShielding: boolean) => void;
  enemies?: EnemyRoomState;
  exitsSealed?: boolean;
}) {
  const visibleAttack = useTemporaryFeedback(lastAttack, 180);
  const visibleBlockedMove = useTemporaryFeedback(blockedMove, 160);
  const visibleDamage = useTemporaryFeedback(lastDamage, 180);
  const visibleAvoidedDamage = useTemporaryFeedback(lastAvoidedDamage, 160);
  const visibleShieldBlock = useTemporaryFeedback(
    enemies?.lastBlockAt ?? null,
    RAT_COMBAT_CONFIG.shieldBlockFlashMs,
  );
  const floorLookup = room ? getFloorLookup(room) : null;
  const wallLookup = room ? getWallLookup(room) : null;
  const facingArrows: Record<CardinalDirection, string> = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };

  function releaseShield() {
    onShieldChange(false);
  }

  function handleShieldPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onShieldChange(true);
  }

  function handleShieldPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseShield();
  }

  function handleShieldKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
      event.preventDefault();
      onShieldChange(true);
    }
  }

  function handleShieldKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      releaseShield();
    }
  }

  return (
    <div className="dungeon-grid-shell">
      <div
        className="dungeon-grid-viewport"
        data-maximum-columns={MAX_ROOM_COLUMNS}
        data-maximum-rows={MAX_ROOM_ROWS}
      >
        <div
          className="dungeon-grid"
          role="application"
          aria-label="Resonant Ruins playable dungeon grid"
          aria-describedby="resonant-ruins-grid-instructions"
          data-game-input-surface
          data-player-status={status}
          data-invulnerable={isInvulnerable}
          data-controls-disabled={controlsDisabled}
          data-room-columns={bounds.columns}
          data-room-rows={bounds.rows}
          tabIndex={0}
          style={
            {
              '--room-columns': bounds.columns,
              '--room-rows': bounds.rows,
              '--rat-lunge-duration': `${RAT_COMBAT_CONFIG.lungeMs}ms`,
              '--rat-corpse-duration': `${RAT_COMBAT_CONFIG.corpseAbsorptionMs}ms`,
            } as CSSProperties
          }
        >
          {Array.from({ length: bounds.rows * bounds.columns }, (_, index) => {
            const row = Math.floor(index / bounds.columns);
            const column = index % bounds.columns;
            const position = { row, column };
            const coordinate = { x: column, y: row };
            const key = `${row}-${column}`;
            const isPlayer = !hidePlayer && positionsMatch(position, player.position);
            const isHazard = hazards.some((hazard) => positionsMatch(position, hazard));
            const isCollapsed = collapsedEntrance
              ? coordinateKey(collapsedEntrance) === coordinateKey(coordinate)
              : false;
            const exit = room ? findExitAt(room, coordinate) : null;
            const rat = enemies?.rats.find(
              (candidate) => coordinateKey(candidate.position) === coordinateKey(coordinate),
            );
            const isWall = Boolean(wallLookup?.has(coordinateKey(coordinate)));
            const isFloor = Boolean(floorLookup?.has(coordinateKey(coordinate)));
            const isAttackTarget =
              status === 'active' && visibleAttack?.target
                ? positionsMatch(position, visibleAttack.target)
                : false;
            const isBumping = visibleBlockedMove
              ? status === 'active' &&
                isPlayer &&
                positionsMatch(player.position, visibleBlockedMove.target)
              : false;
            const legacyKind =
              key === '0-6'
                ? 'rune'
                : key === '2-7'
                  ? 'exit'
                  : key === '2-1'
                    ? 'treasure'
                    : legacyEnemies.has(key)
                      ? 'enemy'
                      : 'empty';
            const kind = room
              ? isCollapsed
                ? 'collapsed-entrance'
                : exit
                  ? exit.enabled
                    ? exitsSealed && exit.condition.type === 'enemies-defeated'
                      ? 'exit-sealed'
                      : 'exit-open'
                    : exit.kind === 'shortcut'
                      ? 'exit-sealed'
                      : 'exit-closed'
                  : isWall
                    ? 'wall'
                    : isFloor
                      ? 'floor'
                      : 'void'
              : legacyKind;
            const className = [
              'tile',
              `tile--${kind}`,
              isPlayer ? 'tile--player' : '',
              isHazard ? 'tile--hazard' : '',
              isAttackTarget ? 'tile--attack-target' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <span key={key} className={className} aria-hidden="true">
                {isPlayer && (
                  <span
                    className={[
                      'player-token',
                      `player-token--facing-${player.facing}`,
                      player.isShielding && status === 'active' ? 'player-token--shielding' : '',
                      isBumping ? 'player-token--bump' : '',
                      visibleDamage && !visibleDamage.fatal && status === 'active'
                        ? 'player-token--damaged'
                        : '',
                      isInvulnerable && status === 'active' ? 'player-token--invulnerable' : '',
                      visibleAvoidedDamage && status === 'active' ? 'player-token--avoided' : '',
                      visibleShieldBlock && status === 'active' ? 'player-token--shield-block' : '',
                      visibleShieldBlock &&
                      status === 'active' &&
                      enemies?.lastBlockKind === 'perfect'
                        ? 'player-token--perfect-block'
                        : '',
                      status === 'defeated' ? 'player-token--defeated' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {status !== 'defeated' && (
                      <span className="player-token__facing">{facingArrows[player.facing]}</span>
                    )}
                    {status !== 'defeated' && player.isShielding && status === 'active' && (
                      <span className="player-token__shield player-token__shield--active" />
                    )}
                    {isInvulnerable && status === 'active' && (
                      <span className="player-token__invulnerable" aria-hidden="true">
                        ◇
                      </span>
                    )}
                    {status === 'defeated' && (
                      <span className="player-token__dead-mark" aria-hidden="true">
                        ×
                      </span>
                    )}
                  </span>
                )}
                {isAttackTarget && <span className="attack-slash">╱</span>}
                {rat && (
                  <span
                    className={`rat-token rat-token--${rat.state} rat-token--facing-${rat.facing} ${
                      rat.health === 1 ? 'rat-token--injured' : ''
                    } ${rat.hitFlashUntil !== null ? 'rat-token--hit' : ''} ${
                      rat.state === 'recovering' && rat.recoveryKind === 'perfect-block'
                        ? 'rat-token--perfect-recoil'
                        : ''
                    }`}
                    data-enemy-id={rat.id}
                    data-enemy-state={rat.state}
                    data-enemy-health={rat.health}
                    data-enemy-x={rat.position.x}
                    data-enemy-y={rat.position.y}
                    data-enemy-facing={rat.facing}
                    data-enemy-awareness={rat.awareness}
                    data-enemy-outcome={rat.attackOutcome ?? undefined}
                  >
                    <span className="rat-token__visual">
                      <span className="rat-token__tail" />
                      <span className="rat-token__body">
                        <span className="rat-token__ear rat-token__ear--upper" />
                        <span className="rat-token__ear rat-token__ear--lower" />
                        <span className="rat-token__snout" />
                        {rat.health === 1 && <span className="rat-token__injury" />}
                      </span>
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <p id="resonant-ruins-grid-instructions" className="grid-hint">
        Resonant Ruins controls: move with WASD or arrow keys, attack with Space, and hold either
        Shift key to shield. Red rune floor markings are walkable hazards that deal damage.
      </p>
      <p className="game-announcement" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="game-controls" aria-label="Resonant Ruins character controls">
        <div className="d-pad">
          <button
            type="button"
            aria-label="Move up"
            onClick={() => onMove('up')}
            disabled={controlsDisabled}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move left"
            onClick={() => onMove('left')}
            disabled={controlsDisabled}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Move down"
            onClick={() => onMove('down')}
            disabled={controlsDisabled}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Move right"
            onClick={() => onMove('right')}
            disabled={controlsDisabled}
          >
            →
          </button>
        </div>
        <div className="action-controls">
          <button
            type="button"
            onClick={onAttack}
            aria-label="Attack in the direction the player is facing"
            disabled={controlsDisabled}
          >
            <span>Attack</span>
            <small>Space</small>
          </button>
          <button
            type="button"
            aria-label="Hold to raise the shield"
            aria-pressed={player.isShielding}
            disabled={controlsDisabled}
            onPointerDown={handleShieldPointerDown}
            onPointerUp={handleShieldPointerUp}
            onPointerCancel={releaseShield}
            onLostPointerCapture={releaseShield}
            onKeyDown={handleShieldKeyDown}
            onKeyUp={handleShieldKeyUp}
            onBlur={releaseShield}
          >
            <span>Hold shield</span>
            <small>Shift</small>
          </button>
        </div>
      </div>
    </div>
  );
}

function useTemporaryFeedback<T>(value: T | null, duration: number): T | null {
  const [visibleValue, setVisibleValue] = useState<T | null>(null);

  useEffect(() => {
    if (!value) return;
    setVisibleValue(value);
    const timer = window.setTimeout(() => setVisibleValue(null), duration);
    return () => window.clearTimeout(timer);
  }, [duration, value]);

  return visibleValue;
}
