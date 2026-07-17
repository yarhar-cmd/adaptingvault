export const RUN_STORAGE_WARNING = 'Run history could not be saved on this device.';
export const RUN_STORAGE_INVALID_WARNING =
  'Saved run history was unreadable. Other local data was preserved.';
export const ACTIVE_RUN_STORAGE_WARNING =
  'Your run could not be saved because browser storage is full. The current session can continue, but refreshing may lose progress.';
export const ACTIVE_RUN_INVALID_WARNING =
  'Saved active run could not be restored. Your profile, settings, and run history were preserved.';
export const ACTIVE_RUN_POSITION_REPAIRED_WARNING =
  'Your saved position was invalid, so you were moved to a safe spawn.';
export const SETTINGS_STORAGE_INVALID_WARNING =
  'Saved settings were unreadable and were reset. Your profile, active run, and run history were preserved.';
export const PROFILE_STORAGE_INVALID_WARNING =
  'Your saved adaptive profile was unreadable and was safely reset. Run history and unrelated settings were preserved.';

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
