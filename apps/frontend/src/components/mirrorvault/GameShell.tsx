import type { ReactNode, RefObject } from 'react';
import { useAdventure } from '../../hooks/useAdventure';
import { StorageWarning } from './StorageWarning';

export function GameShell({
  children,
  showDebug,
  debugOpen,
  debugButtonRef,
  onDebug,
  pauseDisabled,
  pauseButtonRef,
  onPause,
}: {
  children: ReactNode;
  showDebug: boolean;
  debugOpen: boolean;
  debugButtonRef: RefObject<HTMLButtonElement | null>;
  onDebug: () => void;
  pauseDisabled: boolean;
  pauseButtonRef: RefObject<HTMLButtonElement | null>;
  onPause: () => void;
}) {
  const { settings, storageWarning, dismissStorageWarning } = useAdventure();
  return (
    <div
      className={`game-shell ${settings.highContrast ? 'is-high-contrast' : ''} ${settings.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <a className="skip-link" href="#game-main-content">
        Skip to game
      </a>
      <header className="game-shell__header">
        <div className="game-shell__brand" aria-label="Resonant Ruins">
          <span aria-hidden="true">R</span>
          <strong>Resonant Ruins</strong>
        </div>
        <div className="game-shell__header-actions">
          {showDebug && (
            <button
              ref={debugButtonRef}
              type="button"
              className="game-shell__header-button"
              aria-expanded={debugOpen}
              aria-controls="debug-drawer"
              onClick={onDebug}
            >
              Debug
            </button>
          )}
          <button
            ref={pauseButtonRef}
            type="button"
            className="game-shell__header-button"
            disabled={pauseDisabled}
            onClick={onPause}
          >
            Pause
          </button>
        </div>
      </header>
      <main id="game-main-content" className="game-shell__main" tabIndex={-1}>
        {storageWarning && (
          <StorageWarning message={storageWarning} onDismiss={dismissStorageWarning} />
        )}
        {children}
      </main>
    </div>
  );
}
