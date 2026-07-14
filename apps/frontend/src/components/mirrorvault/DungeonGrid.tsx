import { useCallback } from 'react';

export type Direction = 'up' | 'down' | 'left' | 'right';

const enemies = new Set(['2-3', '3-5']);
const hazards = new Set(['1-5', '4-2']);

export function DungeonGrid({
  player,
  onMove,
  onAttack,
}: {
  player: { row: number; column: number };
  onMove: (direction: Direction) => void;
  onAttack: () => void;
}) {
  const keyHandler = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys: Record<string, Direction> = {
        ArrowUp: 'up',
        w: 'up',
        ArrowDown: 'down',
        s: 'down',
        ArrowLeft: 'left',
        a: 'left',
        ArrowRight: 'right',
        d: 'right',
      };
      if (keys[event.key]) {
        event.preventDefault();
        onMove(keys[event.key]);
      }
      if (event.key === ' ') {
        event.preventDefault();
        onAttack();
      }
    },
    [onAttack, onMove],
  );

  return (
    <div>
      <div
        className="dungeon-grid"
        role="application"
        aria-label="Playable dungeon grid. Use arrow keys or WASD to move and Space to attack."
        tabIndex={0}
        onKeyDown={keyHandler}
      >
        {Array.from({ length: 40 }, (_, index) => {
          const row = Math.floor(index / 8);
          const column = index % 8;
          const key = `${row}-${column}`;
          const isPlayer = row === player.row && column === player.column;
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
                    : hazards.has(key)
                      ? 'hazard'
                      : 'empty';
          return <span key={key} className={`tile tile--${kind}`} aria-hidden="true" />;
        })}
      </div>
      <p className="grid-hint">Find the exit. Fight—or reach the rune.</p>
      <div className="game-controls" aria-label="Dungeon controls">
        <div className="d-pad">
          <button type="button" aria-label="Move up" onClick={() => onMove('up')}>
            ↑
          </button>
          <button type="button" aria-label="Move left" onClick={() => onMove('left')}>
            ←
          </button>
          <button type="button" aria-label="Move down" onClick={() => onMove('down')}>
            ↓
          </button>
          <button type="button" aria-label="Move right" onClick={() => onMove('right')}>
            →
          </button>
        </div>
        <div className="action-controls">
          <button type="button" onClick={onAttack}>
            <span>Attack</span>
            <small>Space</small>
          </button>
          <button type="button">
            <span>Hold shield</span>
            <small>Shift</small>
          </button>
        </div>
      </div>
    </div>
  );
}
