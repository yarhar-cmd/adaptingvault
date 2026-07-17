import type { RoomDefinition } from '../types/rooms';

export const EDITOR_DRAFT_KEY = 'mirrorvault:awakening-editor-drafts:v1';
const EDITOR_DRAFT_VERSION = 1;

export interface EditorDraftEnvelope {
  version: 1;
  rooms: Record<string, RoomDefinition>;
}

export function cloneRoom(room: RoomDefinition): RoomDefinition {
  return JSON.parse(JSON.stringify(room)) as RoomDefinition;
}

export function officialDrafts(rooms: readonly RoomDefinition[]): EditorDraftEnvelope {
  return {
    version: EDITOR_DRAFT_VERSION,
    rooms: Object.fromEntries(rooms.map((room) => [room.id, cloneRoom(room)])),
  };
}

export function loadEditorDrafts(
  officialRooms: readonly RoomDefinition[],
  storage: Storage = localStorage,
): { drafts: EditorDraftEnvelope; recovered: boolean } {
  const fallback = officialDrafts(officialRooms);
  try {
    const raw = storage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return { drafts: fallback, recovered: false };
    const value = JSON.parse(raw) as EditorDraftEnvelope;
    if (
      value?.version !== EDITOR_DRAFT_VERSION ||
      typeof value.rooms !== 'object' ||
      officialRooms.some((room) => !value.rooms[room.id])
    )
      throw new Error('Invalid editor draft envelope.');
    return { drafts: value, recovered: false };
  } catch {
    storage.removeItem(EDITOR_DRAFT_KEY);
    return { drafts: fallback, recovered: true };
  }
}

export function saveEditorDrafts(
  drafts: EditorDraftEnvelope,
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}
