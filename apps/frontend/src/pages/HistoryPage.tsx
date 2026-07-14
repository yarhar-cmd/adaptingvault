import { useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { EmptyState } from '../components/common/States';
import { SecondaryButton } from '../components/common/Buttons';
import { clearRuns, loadRuns } from '../services/storage';

export function HistoryPage() {
  const [runs, setRuns] = useState(loadRuns);
  function clearHistory() { clearRuns(); setRuns([]); }
  return (
    <PageContainer eyebrow="Local archive" title="Run history" intro="Completed demo runs are stored on this device. No account or database is connected.">
      {runs.length === 0 ? <EmptyState>No runs have been preserved yet. Complete the six-room demo to make the first entry.</EmptyState> : (
        <div className="history-list">
          {runs.map((run) => (
            <article key={run.id} className="history-card">
              <div><p className="eyebrow">{new Date(run.startedAt).toLocaleString()}</p><h2>{run.character}</h2></div>
              <dl><div><dt>Mode</dt><dd>{run.mode}</dd></div><div><dt>Pressure</dt><dd>{run.challenge}</dd></div><div><dt>Rooms</dt><dd>{run.roomsCleared} / 6</dd></div></dl>
              <p>{run.outcome}</p>
            </article>
          ))}
          <SecondaryButton onClick={clearHistory}>Clear local history</SecondaryButton>
        </div>
      )}
    </PageContainer>
  );
}
