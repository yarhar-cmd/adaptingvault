export function StatusPanel({
  room,
  mode,
  character,
  currentHealth,
  maximumHealth,
  isInvulnerable,
  isDefeated,
}: {
  room: number;
  mode: string;
  character: string;
  currentHealth: number;
  maximumHealth: number;
  isInvulnerable: boolean;
  isDefeated: boolean;
}) {
  const healthStatus = isDefeated ? ' You were defeated.' : isInvulnerable ? ' Invulnerable.' : '';

  return (
    <aside className="run-status" aria-label="Current run status">
      <div>
        <span>{room <= 3 ? 'Assessment' : 'Adaptation'}</span>
        <strong>{String(room).padStart(2, '0')} / 06</strong>
      </div>
      <div>
        <span>Mode</span>
        <strong>{mode}</strong>
      </div>
      <div>
        <span>Delver</span>
        <strong>{character}</strong>
      </div>
      <div
        className="health"
        aria-label={`${currentHealth} of ${maximumHealth} health remaining.${healthStatus}`}
      >
        <span className="health__indicators" aria-hidden="true">
          {Array.from({ length: maximumHealth }, (_, index) => (
            <span
              key={index}
              className={index < currentHealth ? 'health__remaining' : 'health__missing'}
            >
              {index < currentHealth ? '◆' : '◇'}
            </span>
          ))}
        </span>
        {isInvulnerable && !isDefeated && <span className="health__condition">◇ Invulnerable</span>}
        {isDefeated && (
          <span className="health__condition health__condition--defeated">× Defeated</span>
        )}
      </div>
    </aside>
  );
}
