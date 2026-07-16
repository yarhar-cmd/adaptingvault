import { useEffect, useRef, type RefObject } from 'react';

interface DefeatControlsOptions {
  defeated: boolean;
  gameRegionRef: RefObject<HTMLElement | null>;
  onRestart: () => void;
  onToggleResults: () => void;
}

export function useDefeatControls({
  defeated,
  gameRegionRef,
  onRestart,
  onToggleResults,
}: DefeatControlsOptions): void {
  const defeatedRef = useRef(defeated);
  const onRestartRef = useRef(onRestart);
  const onToggleResultsRef = useRef(onToggleResults);
  const heldRRef = useRef(false);

  defeatedRef.current = defeated;
  onRestartRef.current = onRestart;
  onToggleResultsRef.current = onToggleResults;

  useEffect(() => {
    function focusIsInsideGameRegion(): boolean {
      return Boolean(
        gameRegionRef.current &&
        document.activeElement &&
        gameRegionRef.current.contains(document.activeElement),
      );
    }

    function focusIsEditable(): boolean {
      const activeElement = document.activeElement;
      return Boolean(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable),
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === 'KeyR') {
        const wasHeld = heldRRef.current;
        heldRRef.current = true;
        if (
          wasHeld ||
          event.repeat ||
          !defeatedRef.current ||
          !focusIsInsideGameRegion() ||
          focusIsEditable()
        ) {
          return;
        }

        event.preventDefault();
        onRestartRef.current();
        return;
      }

      if (
        event.code === 'Escape' &&
        !event.repeat &&
        defeatedRef.current &&
        focusIsInsideGameRegion()
      ) {
        event.preventDefault();
        onToggleResultsRef.current();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === 'KeyR') heldRRef.current = false;
    }

    function clearHeldKey() {
      heldRRef.current = false;
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', clearHeldKey);
    document.addEventListener('visibilitychange', clearHeldKey);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', clearHeldKey);
      document.removeEventListener('visibilitychange', clearHeldKey);
    };
  }, [gameRegionRef]);
}
