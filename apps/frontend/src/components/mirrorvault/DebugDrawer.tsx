import { useEffect, useId, useRef, type ComponentProps, type RefObject } from 'react';
import { DebugTools } from './DebugTools';

export function DebugDrawer({
  open,
  triggerRef,
  onClose,
  debugToolsProps,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  debugToolsProps: ComponentProps<typeof DebugTools>;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyOpenRef = useRef(false);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (previouslyOpenRef.current) triggerRef.current?.focus();
    previouslyOpenRef.current = open;
  }, [open, triggerRef]);

  if (!open) return null;
  return (
    <aside
      id="debug-drawer"
      className="debug-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="debug-drawer__header">
        <h2 id={titleId}>Debug Tools</h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close Debug Tools">
          ×
        </button>
      </header>
      <div className="debug-drawer__body">
        <DebugTools {...debugToolsProps} />
      </div>
    </aside>
  );
}
