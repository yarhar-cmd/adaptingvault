import { useEffect, useId, useRef } from 'react';
import { PrimaryButton, SecondaryButton } from '../common/Buttons';

export const GAME_OVER_SUBTITLE = 'The ruins remember your attempt.';

interface GameOverResultsProps {
  visible: boolean;
  characterName: string;
  timeSurvived: string;
  roomsCleared: number;
  enemiesDefeated: number;
  onHide: () => void;
  onReopen: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export function GameOverResults({
  visible,
  characterName,
  timeSurvived,
  roomsCleared,
  enemiesDefeated,
  onHide,
  onReopen,
  onRestart,
  onMainMenu,
}: GameOverResultsProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const compactRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (visible) dialogRef.current?.focus();
    else compactRef.current?.focus();
  }, [visible]);

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-game-over-focusable]'),
    );
    if (focusable.length === 0) return;

    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? activeIndex <= 0
        ? focusable.length - 1
        : activeIndex - 1
      : activeIndex < 0 || activeIndex === focusable.length - 1
        ? 0
        : activeIndex + 1;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  if (!visible) {
    return (
      <button
        ref={compactRef}
        type="button"
        className="compact-results-strip"
        onClick={onReopen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onReopen();
          }
        }}
        aria-label={`Show game-over results. Time ${timeSurvived}, rooms cleared ${roomsCleared}, enemies defeated ${enemiesDefeated}.`}
      >
        <span>
          <small>Time</small>
          <strong>{timeSurvived}</strong>
        </span>
        <span>
          <small>Dungeon rooms</small>
          <strong>{roomsCleared}</strong>
        </span>
        <span>
          <small>Enemies</small>
          <strong>{enemiesDefeated}</strong>
        </span>
      </button>
    );
  }

  return (
    <div
      className="game-over-backdrop"
      onClick={(event) => event.currentTarget === event.target && onHide()}
    >
      <section
        ref={dialogRef}
        className="game-over-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <button
          type="button"
          className="game-over-dialog__close"
          aria-label="Hide game-over results"
          data-game-over-focusable
          onClick={onHide}
        >
          ×
        </button>
        <p className="eyebrow">Resonant Ruins</p>
        <h2 id={titleId}>Game Over</h2>
        <p id={descriptionId} className="game-over-dialog__subtitle">
          {GAME_OVER_SUBTITLE}
        </p>
        <dl className="game-over-stats">
          <div>
            <dt>Character</dt>
            <dd>{characterName}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{timeSurvived}</dd>
          </div>
          <div>
            <dt>Dungeon Rooms Cleared</dt>
            <dd>{roomsCleared}</dd>
          </div>
          <div>
            <dt>Enemies defeated</dt>
            <dd>{enemiesDefeated}</dd>
          </div>
        </dl>
        <div className="game-over-dialog__actions">
          <PrimaryButton data-game-over-focusable onClick={onRestart}>
            Restart Run
          </PrimaryButton>
          <SecondaryButton data-game-over-focusable onClick={onMainMenu}>
            Main Menu
          </SecondaryButton>
        </div>
        <p className="game-over-dialog__hints">
          <span>R — Restart Run</span>
          <span>Esc — Hide Results</span>
        </p>
      </section>
    </div>
  );
}
