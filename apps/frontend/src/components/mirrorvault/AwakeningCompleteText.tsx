import { useEffect } from 'react';

export function AwakeningCompleteText({ onFinished }: { onFinished: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinished, 2_800);
    return () => window.clearTimeout(timer);
  }, [onFinished]);

  return (
    <div className="awakening-complete-text" role="status" aria-live="polite" aria-atomic="true">
      <strong>Awakening Complete</strong>
      <span>The real challenge begins</span>
    </div>
  );
}
