import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { PrimaryButton, SecondaryButton } from '../common/Buttons';

type PauseConfirmation = 'restart' | 'main-menu' | null;

export function PauseMenu({
  open,
  pauseButtonRef,
  savedMessage,
  onResume,
  onSettings,
  onRestart,
  onMainMenu,
}: {
  open: boolean;
  pauseButtonRef: RefObject<HTMLButtonElement | null>;
  savedMessage?: string;
  onResume: () => void;
  onSettings: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}) {
  const titleId = useId();
  const resumeRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const mainMenuRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyOpenRef = useRef(false);
  const previousConfirmationRef = useRef<PauseConfirmation>(null);
  const [confirmation, setConfirmation] = useState<PauseConfirmation>(null);

  useEffect(() => {
    if (open) {
      if (confirmation) cancelRef.current?.focus();
      else if (previousConfirmationRef.current === 'restart') restartRef.current?.focus();
      else if (previousConfirmationRef.current === 'main-menu') mainMenuRef.current?.focus();
      else resumeRef.current?.focus();
    } else if (previouslyOpenRef.current) {
      pauseButtonRef.current?.focus();
      setConfirmation(null);
    }
    previousConfirmationRef.current = confirmation;
    previouslyOpenRef.current = open;
  }, [confirmation, open, pauseButtonRef]);

  if (!open) return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (confirmation) setConfirmation(null);
      else onResume();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-pause-focusable]'),
    );
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? index <= 0
        ? focusable.length - 1
        : index - 1
      : index < 0 || index === focusable.length - 1
        ? 0
        : index + 1;
    event.preventDefault();
    focusable[next]?.focus();
  }

  return (
    <div className="pause-backdrop">
      <section
        className="pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        {confirmation === 'restart' ? (
          <>
            <p className="eyebrow">Paused run</p>
            <h2 id={titleId}>Restart Run?</h2>
            <p>
              Your current run and progress will be lost.
              <br />
              <br />
              Your character, experience preset, adaptive profile, and unlocked Awakening shortcut
              will remain.
            </p>
            <div className="pause-menu__actions">
              <SecondaryButton
                ref={cancelRef}
                data-pause-focusable
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton data-pause-focusable onClick={onRestart}>
                Restart Run
              </PrimaryButton>
            </div>
          </>
        ) : confirmation === 'main-menu' ? (
          <>
            <p className="eyebrow">Paused run</p>
            <h2 id={titleId}>Return to Main Menu?</h2>
            <p>Your active run will be preserved. You can resume it later.</p>
            <div className="pause-menu__actions">
              <SecondaryButton
                ref={cancelRef}
                data-pause-focusable
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton data-pause-focusable onClick={onMainMenu}>
                Return to Main Menu
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Resonant Ruins</p>
            <h2 id={titleId}>Paused</h2>
            {savedMessage && <p className="pause-menu__save-status">{savedMessage}</p>}
            <div className="pause-menu__actions">
              <PrimaryButton ref={resumeRef} data-pause-focusable onClick={onResume}>
                Resume
              </PrimaryButton>
              <SecondaryButton data-pause-focusable onClick={onSettings}>
                Settings
              </SecondaryButton>
              <SecondaryButton
                ref={restartRef}
                data-pause-focusable
                onClick={() => setConfirmation('restart')}
              >
                Restart Run
              </SecondaryButton>
              <SecondaryButton
                ref={mainMenuRef}
                data-pause-focusable
                onClick={() => setConfirmation('main-menu')}
              >
                Main Menu
              </SecondaryButton>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
