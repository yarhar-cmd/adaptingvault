import { useMemo, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { EmptyState } from '../components/common/States';
import { SecondaryButton } from '../components/common/Buttons';
import {
  RUN_STORAGE_INVALID_WARNING,
  StorageWarning,
} from '../components/mirrorvault/StorageWarning';
import {
  getFilteredRunArchiveView,
  loadRunArchive,
  type CharacterId,
  type RunArchiveFilters,
} from '../services/runArchive';
import { EXPERIENCE_PRESETS, type StoredExperiencePreset } from '../types/adaptation';
import { formatSurvivalTime } from '../utils/gameplayState';

const characterLabels: Record<CharacterId, string> = {
  warden: 'Warden',
  seeker: 'Seeker',
  ember: 'Ember',
};
const experienceLabels: Record<StoredExperiencePreset, string> = {
  'new-delver': EXPERIENCE_PRESETS['new-delver'].label,
  'seasoned-adventurer': EXPERIENCE_PRESETS['seasoned-adventurer'].label,
  'dungeon-veteran': EXPERIENCE_PRESETS['dungeon-veteran'].label,
  unknown: 'Unknown Experience',
};
const clearFilters: RunArchiveFilters = { characterId: 'all', experiencePreset: 'all' };

export function HistoryPage() {
  const [loaded] = useState(loadRunArchive);
  const [filters, setFilters] = useState<RunArchiveFilters>(clearFilters);
  const [showWarning, setShowWarning] = useState(Boolean(loaded.issue));
  const view = useMemo(
    () => getFilteredRunArchiveView(loaded.data, filters),
    [filters, loaded.data],
  );
  const allRuns = Object.values(loaded.data.histories).flat();
  const filtersActive = filters.characterId !== 'all' || filters.experiencePreset !== 'all';
  const bestBadges = new Map<string, string[]>();
  for (const [label, runId] of [
    ['Best Survival', view.best.bestTimeRunId],
    ['Best Rooms', view.best.bestRoomsRunId],
    ['Best Enemies', view.best.bestEnemiesRunId],
  ] as const) {
    if (runId) bestBadges.set(runId, [...(bestBadges.get(runId) ?? []), label]);
  }

  return (
    <PageContainer
      eyebrow="Local archive"
      title="Runs"
      intro="Defeated runs are stored only in this browser and remain partitioned by character and experience."
    >
      {showWarning && (
        <StorageWarning
          message={RUN_STORAGE_INVALID_WARNING}
          onDismiss={() => setShowWarning(false)}
        />
      )}
      <div className="runs-filters" aria-label="Run history filters">
        <label>
          Character
          <select
            value={filters.characterId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                characterId: event.target.value as RunArchiveFilters['characterId'],
              }))
            }
          >
            <option value="all">All</option>
            {Object.entries(characterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Experience
          <select
            value={filters.experiencePreset}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                experiencePreset: event.target.value as RunArchiveFilters['experiencePreset'],
              }))
            }
          >
            <option value="all">All</option>
            {Object.entries(experienceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <SecondaryButton disabled={!filtersActive} onClick={() => setFilters(clearFilters)}>
          Clear Filters
        </SecondaryButton>
      </div>

      <section className="best-runs" aria-labelledby="best-runs-title">
        <h2 id="best-runs-title">Best Runs</h2>
        <dl className="best-runs__grid">
          <div>
            <dt>Best Survival Time</dt>
            <dd>{formatSurvivalTime(view.best.bestTimeSurvivedMs)}</dd>
          </div>
          <div>
            <dt>Best Dungeon Rooms Cleared</dt>
            <dd>{view.best.bestDungeonRoomsCleared}</dd>
          </div>
          <div>
            <dt>Best Enemies Defeated</dt>
            <dd>{view.best.bestEnemiesDefeated}</dd>
          </div>
        </dl>
      </section>

      <section className="recent-runs" aria-labelledby="recent-runs-title">
        <h2 id="recent-runs-title">Recent Runs</h2>
        {view.recentRuns.length === 0 ? (
          <EmptyState>
            {allRuns.length === 0 ? (
              <>
                No completed runs yet.
                <br />
                Your defeated runs will appear here.
              </>
            ) : (
              <>
                No runs match these filters.
                <br />
                <button
                  className="button button--secondary"
                  onClick={() => setFilters(clearFilters)}
                >
                  Clear Filters
                </button>
              </>
            )}
          </EmptyState>
        ) : (
          <div className="history-list">
            {view.recentRuns.map((run) => (
              <article key={run.id} className="history-card">
                <header>
                  <p className="eyebrow">{new Date(run.endedAt).toLocaleString()}</p>
                  <h3>{characterLabels[run.characterId]}</h3>
                  <p>{experienceLabels[run.experiencePreset]}</p>
                </header>
                <dl>
                  <div>
                    <dt>Survival time</dt>
                    <dd>{formatSurvivalTime(run.timeSurvivedMs)}</dd>
                  </div>
                  <div>
                    <dt>Dungeon rooms cleared</dt>
                    <dd>{run.dungeonRoomsCleared}</dd>
                  </div>
                  <div>
                    <dt>Enemies defeated</dt>
                    <dd>{run.enemiesDefeated}</dd>
                  </div>
                </dl>
                {bestBadges.has(run.id) && (
                  <ul className="run-best-badges" aria-label="Best records owned by this run">
                    {bestBadges.get(run.id)!.map((badge) => (
                      <li key={badge}>{badge}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
