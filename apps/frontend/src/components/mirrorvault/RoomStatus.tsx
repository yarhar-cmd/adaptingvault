export function RoomStatus({ label }: { label: string }) {
  return (
    <p className="room-status-announcement" role="status" aria-live="polite" aria-atomic="true">
      {label}
    </p>
  );
}
