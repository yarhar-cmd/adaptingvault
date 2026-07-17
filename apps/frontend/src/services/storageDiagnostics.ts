import { ACTIVE_RUN_VERSION, createActiveRunRecord } from './activeRunStorage';
import { RUN_ARCHIVE_KEY, RUN_ARCHIVE_VERSION, type CharacterId } from './runArchive';
import type { GameplayState } from '../utils/gameplayState';

export interface StorageDiagnostics {
  activeRunBytes: number;
  runArchiveBytes: number;
  detailedSnapshots: number;
  currentVisitedTiles: number;
  summarizedRooms: number;
  activeRunSchemaVersion: number;
  archiveSchemaVersion: number;
}

export function serializedByteSize(value: unknown): number {
  return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
}

export function getStorageDiagnostics(
  gameplay: GameplayState,
  characterId: CharacterId,
  now: number,
  storage: Storage = window.localStorage,
): StorageDiagnostics {
  const activeRecord = createActiveRunRecord(gameplay, characterId, now);
  const archiveRaw = storage.getItem(RUN_ARCHIVE_KEY) ?? '';
  return {
    activeRunBytes: activeRecord ? serializedByteSize(activeRecord) : 0,
    runArchiveBytes: serializedByteSize(archiveRaw),
    detailedSnapshots: gameplay.adaptation.generatedRoomSignals.length,
    currentVisitedTiles: gameplay.adaptation.signals.floorTilesVisited.length,
    summarizedRooms: gameplay.adaptation.completedSummary.roomCount,
    activeRunSchemaVersion: ACTIVE_RUN_VERSION,
    archiveSchemaVersion: RUN_ARCHIVE_VERSION,
  };
}

export function formatByteSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
