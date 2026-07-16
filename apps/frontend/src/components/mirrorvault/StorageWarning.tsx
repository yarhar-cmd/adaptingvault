export const RUN_STORAGE_WARNING = 'Run history could not be saved on this device.';
export const RUN_STORAGE_INVALID_WARNING =
  'Saved run history was unreadable and has been safely replaced.';
export const ACTIVE_RUN_STORAGE_WARNING = 'Active run could not be saved on this device.';
export const ACTIVE_RUN_INVALID_WARNING =
  'Saved active run could not be restored. A fresh run has started.';

export function StorageWarning({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <aside className="run-storage-warning" role="status" aria-live="polite" aria-atomic="true">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss run history warning">
        ×
      </button>
    </aside>
  );
}
