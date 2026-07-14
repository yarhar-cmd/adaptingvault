export function StatusPanel({
  room,
  mode,
  character,
}: {
  room: number;
  mode: string;
  character: string;
}) {
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
      <div className="health" aria-label="5 health remaining">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index}>◆</span>
        ))}
      </div>
    </aside>
  );
}
