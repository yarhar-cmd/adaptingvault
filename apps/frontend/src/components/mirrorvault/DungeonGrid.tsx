import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type {
  AttackAction,
  CardinalDirection,
  MoveResult,
  PlayerState,
  RoomBounds,
} from '../../types/player';
import type { AvoidedDamageEvent, DamageEvent, GameplayStatus } from '../../utils/gameplayState';
import { getProtectedTile, positionsMatch } from '../../utils/playerActions';

const enemies = new Set(['2-3', '3-5']);

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
  onMove,
  onAttack,
  onShieldChange,
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
  onMove: (direction: CardinalDirection) => void;
  onAttack: () => boolean;
  onShieldChange: (isShielding: boolean) => void;
}) {
  const visibleAttack = useTemporaryFeedback(lastAttack, 180);
  const visibleBlockedMove = useTemporaryFeedback(blockedMove, 160);
  const visibleDamage = useTemporaryFeedback(lastDamage, 180);
  const visibleAvoidedDamage = useTemporaryFeedback(lastAvoidedDamage, 160);
  const protectedTile = status === 'active' ? getProtectedTile(player, bounds) : null;
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
    <div>
      <div
        className="dungeon-grid"
        role="application"
        aria-label="Resonant Ruins playable dungeon grid"
        aria-describedby="resonant-ruins-grid-instructions"
        data-game-input-surface
        data-player-status={status}
        data-invulnerable={isInvulnerable}
        tabIndex={0}
      >
        {Array.from({ length: bounds.rows * bounds.columns }, (_, index) => {
          const row = Math.floor(index / bounds.columns);
          const column = index % bounds.columns;
          const position = { row, column };
          const key = `${row}-${column}`;
          const isPlayer = positionsMatch(position, player.position);
          const isHazard = hazards.some((hazard) => positionsMatch(position, hazard));
          const isProtected = protectedTile ? positionsMatch(position, protectedTile) : false;
          const isAttackTarget =
            status === 'active' && visibleAttack?.target
              ? positionsMatch(position, visibleAttack.target)
              : false;
          const isBumping = visibleBlockedMove
            ? status === 'active' &&
              isPlayer &&
              positionsMatch(player.position, visibleBlockedMove.target)
            : false;
          const kind = isPlayer
            ? 'player'
            : key === '0-6'
              ? 'rune'
              : key === '2-7'
                ? 'exit'
                : key === '2-1'
                  ? 'treasure'
                  : enemies.has(key)
                    ? 'enemy'
                    : 'empty';
          const className = [
            'tile',
            `tile--${kind}`,
            isHazard ? 'tile--hazard' : '',
            isProtected ? 'tile--shield-protected' : '',
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
                    player.isShielding && status === 'active' ? 'player-token--shielding' : '',
                    isBumping ? 'player-token--bump' : '',
                    visibleDamage && !visibleDamage.fatal && status === 'active'
                      ? 'player-token--damaged'
                      : '',
                    isInvulnerable && status === 'active' ? 'player-token--invulnerable' : '',
                    visibleAvoidedDamage && status === 'active' ? 'player-token--avoided' : '',
                    status === 'defeated' ? 'player-token--defeated' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {status !== 'defeated' && (
                    <span className="player-token__facing">{facingArrows[player.facing]}</span>
                  )}
                  {player.isShielding && status === 'active' && (
                    <span className="player-token__shield">◆</span>
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
              {isProtected && <span className="shield-tile-marker">⬡</span>}
              {isAttackTarget && <span className="attack-slash">╱</span>}
            </span>
          );
        })}
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
