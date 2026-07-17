import { isExperiencePreset, type StoredExperiencePreset } from '../types/adaptation';

export const RUN_ARCHIVE_KEY = 'mirrorvault:run-archive:v1';
export const RUN_ARCHIVE_VERSION = 2 as const;
export const RUN_HISTORY_LIMIT = 5;
export type CharacterId = 'warden' | 'seeker' | 'ember';

export interface CompletedRunRecord {
  version: 2;
  id: string;
  characterId: CharacterId;
  experiencePreset: StoredExperiencePreset;
  endedAt: string;
  timeSurvivedMs: number;
  dungeonRoomsCleared: number;
  /** Migration compatibility alias. */
  roomsCleared?: number;
  enemiesDefeated: number;
}
export interface CharacterBestStats {
  bestTimeSurvivedMs: number;
  bestTimeRunId: string | null;
  bestDungeonRoomsCleared: number;
  bestRoomsCleared: number;
  bestRoomsRunId: string | null;
  bestEnemiesDefeated: number;
  bestEnemiesRunId: string | null;
}
export type PresetBestStats = Record<StoredExperiencePreset, CharacterBestStats> &
  Partial<CharacterBestStats>;
export interface RunArchiveData {
  version: 2;
  histories: Record<CharacterId, CompletedRunRecord[]>;
  bestStats: Record<CharacterId, PresetBestStats>;
}
export type RunArchiveIssue = 'unavailable' | 'invalid' | 'write-failed';
export interface ArchiveCompletedRunResult {
  data: RunArchiveData;
  saved: boolean;
  duplicate: boolean;
  issue: RunArchiveIssue | null;
}

export const RUN_ARCHIVE_CHARACTER_IDS: CharacterId[] = ['warden', 'seeker', 'ember'];
export const RUN_ARCHIVE_PRESET_IDS: StoredExperiencePreset[] = [
  'new-delver',
  'seasoned-adventurer',
  'dungeon-veteran',
  'unknown',
];
const characterIds = RUN_ARCHIVE_CHARACTER_IDS;
const presetIds = RUN_ARCHIVE_PRESET_IDS;

export interface RunArchiveFilters {
  characterId: CharacterId | 'all';
  experiencePreset: StoredExperiencePreset | 'all';
}

export interface FilteredRunArchiveView {
  recentRuns: CompletedRunRecord[];
  best: CharacterBestStats;
}
function emptyBest(): CharacterBestStats {
  return {
    bestTimeSurvivedMs: 0,
    bestTimeRunId: null,
    bestDungeonRoomsCleared: 0,
    bestRoomsCleared: 0,
    bestRoomsRunId: null,
    bestEnemiesDefeated: 0,
    bestEnemiesRunId: null,
  };
}
function emptyPresetBests(): PresetBestStats {
  return {
    'new-delver': emptyBest(),
    'seasoned-adventurer': emptyBest(),
    'dungeon-veteran': emptyBest(),
    unknown: emptyBest(),
  };
}
export function createEmptyRunArchive(): RunArchiveData {
  return {
    version: RUN_ARCHIVE_VERSION,
    histories: { warden: [], seeker: [], ember: [] },
    bestStats: {
      warden: emptyPresetBests(),
      seeker: emptyPresetBests(),
      ember: emptyPresetBests(),
    },
  };
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && characterIds.includes(value as CharacterId);
}
function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}
function isStoredPreset(value: unknown): value is StoredExperiencePreset {
  return value === 'unknown' || isExperiencePreset(value);
}

function parseRecord(value: unknown): CompletedRunRecord | null {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !isCharacterId(value.characterId) ||
    !isIsoDate(value.endedAt) ||
    !isCount(value.timeSurvivedMs) ||
    !isCount(value.enemiesDefeated)
  )
    return null;
  if (value.version === 1 && isCount(value.roomsCleared)) {
    return {
      version: 2,
      id: value.id,
      characterId: value.characterId,
      experiencePreset: 'unknown',
      endedAt: value.endedAt,
      timeSurvivedMs: value.timeSurvivedMs,
      dungeonRoomsCleared: value.roomsCleared,
      enemiesDefeated: value.enemiesDefeated,
    };
  }
  if (
    value.version !== 2 ||
    !isStoredPreset(value.experiencePreset) ||
    !isCount(value.dungeonRoomsCleared)
  )
    return null;
  return {
    version: 2,
    id: value.id,
    characterId: value.characterId,
    experiencePreset: value.experiencePreset,
    endedAt: value.endedAt,
    timeSurvivedMs: value.timeSurvivedMs,
    dungeonRoomsCleared: value.dungeonRoomsCleared,
    enemiesDefeated: value.enemiesDefeated,
  };
}
function parseBest(value: unknown): CharacterBestStats | null {
  if (!isObject(value)) return null;
  const rooms = isCount(value.bestDungeonRoomsCleared)
    ? value.bestDungeonRoomsCleared
    : value.bestRoomsCleared;
  if (!isCount(value.bestTimeSurvivedMs) || !isCount(rooms) || !isCount(value.bestEnemiesDefeated))
    return null;
  for (const key of ['bestTimeRunId', 'bestRoomsRunId', 'bestEnemiesRunId'])
    if (value[key] !== null && (typeof value[key] !== 'string' || !value[key])) return null;
  return {
    bestTimeSurvivedMs: value.bestTimeSurvivedMs,
    bestTimeRunId: value.bestTimeRunId as string | null,
    bestDungeonRoomsCleared: rooms,
    bestRoomsCleared: rooms,
    bestRoomsRunId: value.bestRoomsRunId as string | null,
    bestEnemiesDefeated: value.bestEnemiesDefeated,
    bestEnemiesRunId: value.bestEnemiesRunId as string | null,
  };
}
function updateBest(best: CharacterBestStats, record: CompletedRunRecord): CharacterBestStats {
  const rooms = record.dungeonRoomsCleared;
  return {
    bestTimeSurvivedMs:
      record.timeSurvivedMs >= best.bestTimeSurvivedMs
        ? record.timeSurvivedMs
        : best.bestTimeSurvivedMs,
    bestTimeRunId:
      record.timeSurvivedMs >= best.bestTimeSurvivedMs ? record.id : best.bestTimeRunId,
    bestDungeonRoomsCleared:
      rooms >= best.bestDungeonRoomsCleared ? rooms : best.bestDungeonRoomsCleared,
    bestRoomsCleared: rooms >= best.bestRoomsCleared ? rooms : best.bestRoomsCleared,
    bestRoomsRunId: rooms >= best.bestDungeonRoomsCleared ? record.id : best.bestRoomsRunId,
    bestEnemiesDefeated:
      record.enemiesDefeated >= best.bestEnemiesDefeated
        ? record.enemiesDefeated
        : best.bestEnemiesDefeated,
    bestEnemiesRunId:
      record.enemiesDefeated >= best.bestEnemiesDefeated ? record.id : best.bestEnemiesRunId,
  };
}

function migrateVersionOne(value: Record<string, unknown>): RunArchiveData | null {
  if (!isObject(value.histories)) return null;
  const archive = createEmptyRunArchive();
  for (const characterId of characterIds) {
    const raw = value.histories[characterId];
    if (!Array.isArray(raw) || raw.length > RUN_HISTORY_LIMIT) return null;
    const records = raw.map(parseRecord);
    if (records.some((record) => !record || record.characterId !== characterId)) return null;
    archive.histories[characterId] = records as CompletedRunRecord[];
    for (const record of records as CompletedRunRecord[])
      archive.bestStats[characterId].unknown = updateBest(
        archive.bestStats[characterId].unknown,
        record,
      );
  }
  return archive;
}

export function parseRunArchive(value: unknown): RunArchiveData | null {
  if (!isObject(value)) return null;
  if (value.version === 1) return migrateVersionOne(value);
  if (value.version !== 2 || !isObject(value.histories) || !isObject(value.bestStats)) return null;
  const archive = createEmptyRunArchive();
  for (const characterId of characterIds) {
    const rawHistory = value.histories[characterId];
    const rawBests = value.bestStats[characterId];
    if (!Array.isArray(rawHistory) || rawHistory.length > RUN_HISTORY_LIMIT || !isObject(rawBests))
      return null;
    const history = rawHistory.map(parseRecord);
    if (history.some((record) => !record || record.characterId !== characterId)) return null;
    archive.histories[characterId] = history as CompletedRunRecord[];
    for (const preset of presetIds) {
      const best = parseBest(rawBests[preset]);
      if (!best) return null;
      archive.bestStats[characterId][preset] = best;
    }
  }
  return archive;
}
function resolveStorage(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}
export function loadRunArchive(storage?: Storage): {
  data: RunArchiveData;
  issue: Exclude<RunArchiveIssue, 'write-failed'> | null;
} {
  try {
    const raw = resolveStorage(storage).getItem(RUN_ARCHIVE_KEY);
    if (raw === null) return { data: createEmptyRunArchive(), issue: null };
    const parsed = parseRunArchive(JSON.parse(raw));
    return parsed
      ? { data: parsed, issue: null }
      : { data: createEmptyRunArchive(), issue: 'invalid' };
  } catch (error) {
    return {
      data: createEmptyRunArchive(),
      issue: error instanceof SyntaxError ? 'invalid' : 'unavailable',
    };
  }
}
export function createCompletedRunRecord(record: {
  id: string;
  characterId: CharacterId;
  experiencePreset?: StoredExperiencePreset;
  endedAt: string;
  timeSurvivedMs: number;
  dungeonRoomsCleared?: number;
  roomsCleared?: number;
  enemiesDefeated: number;
}): CompletedRunRecord {
  const count = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
  return {
    version: 2,
    id: record.id,
    characterId: record.characterId,
    experiencePreset: record.experiencePreset ?? 'unknown',
    endedAt: record.endedAt,
    timeSurvivedMs: count(record.timeSurvivedMs),
    dungeonRoomsCleared: count(record.dungeonRoomsCleared ?? record.roomsCleared ?? 0),
    enemiesDefeated: count(record.enemiesDefeated),
  };
}
export function archiveCompletedRun(
  record: CompletedRunRecord,
  storage?: Storage,
): ArchiveCompletedRunResult {
  const loaded = loadRunArchive(storage);
  const duplicate = characterIds.some((id) =>
    loaded.data.histories[id].some((item) => item.id === record.id),
  );
  if (duplicate) return { data: loaded.data, saved: true, duplicate: true, issue: loaded.issue };
  const history = [record, ...loaded.data.histories[record.characterId]]
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))
    .slice(0, RUN_HISTORY_LIMIT);
  const preset = record.experiencePreset;
  const data: RunArchiveData = {
    ...loaded.data,
    histories: { ...loaded.data.histories, [record.characterId]: history },
    bestStats: {
      ...loaded.data.bestStats,
      [record.characterId]: {
        ...loaded.data.bestStats[record.characterId],
        [preset]: updateBest(loaded.data.bestStats[record.characterId][preset], record),
      },
    },
  };
  try {
    resolveStorage(storage).setItem(RUN_ARCHIVE_KEY, JSON.stringify(data));
    return { data, saved: true, duplicate: false, issue: loaded.issue };
  } catch {
    return { data, saved: false, duplicate: false, issue: 'write-failed' };
  }
}

export function getFilteredRunArchiveView(
  archive: RunArchiveData,
  filters: RunArchiveFilters,
): FilteredRunArchiveView {
  const characters =
    filters.characterId === 'all' ? characterIds : ([filters.characterId] as CharacterId[]);
  const presets =
    filters.experiencePreset === 'all'
      ? presetIds
      : ([filters.experiencePreset] as StoredExperiencePreset[]);
  const recentRuns = characters
    .flatMap((characterId) => archive.histories[characterId])
    .filter(
      (run) =>
        filters.experiencePreset === 'all' || run.experiencePreset === filters.experiencePreset,
    )
    .sort((left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt));
  const best = emptyBest();
  for (const characterId of characters) {
    for (const preset of presets) {
      const partition = archive.bestStats[characterId][preset];
      if (partition.bestTimeSurvivedMs >= best.bestTimeSurvivedMs) {
        best.bestTimeSurvivedMs = partition.bestTimeSurvivedMs;
        best.bestTimeRunId = partition.bestTimeRunId;
      }
      if (partition.bestDungeonRoomsCleared >= best.bestDungeonRoomsCleared) {
        best.bestDungeonRoomsCleared = partition.bestDungeonRoomsCleared;
        best.bestRoomsCleared = partition.bestDungeonRoomsCleared;
        best.bestRoomsRunId = partition.bestRoomsRunId;
      }
      if (partition.bestEnemiesDefeated >= best.bestEnemiesDefeated) {
        best.bestEnemiesDefeated = partition.bestEnemiesDefeated;
        best.bestEnemiesRunId = partition.bestEnemiesRunId;
      }
    }
  }
  return { recentRuns, best };
}
