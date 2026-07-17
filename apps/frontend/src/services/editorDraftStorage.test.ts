import { beforeEach, describe, expect, it } from 'vitest';
import { evaluationRooms } from '../data/rooms/evaluationRooms';
import {
  EDITOR_DRAFT_KEY,
  loadEditorDrafts,
  officialDrafts,
  saveEditorDrafts,
} from './editorDraftStorage';

describe('Resonant Ruins Awakening editor draft storage', () => {
  beforeEach(() => localStorage.clear());

  it('uses a dedicated versioned key and never touches active-run storage', () => {
    const activeKey = 'mirrorvault:active-run:v1';
    localStorage.setItem(activeKey, '{"sentinel":true}');
    const drafts = officialDrafts(evaluationRooms);
    expect(saveEditorDrafts(drafts)).toBe(true);
    expect(localStorage.getItem(EDITOR_DRAFT_KEY)).toContain('evaluation-room-05');
    expect(localStorage.getItem(activeKey)).toBe('{"sentinel":true}');
    expect(loadEditorDrafts(evaluationRooms)).toEqual({ drafts, recovered: false });
  });

  it('clears only corrupt editor drafts and recovers official rooms', () => {
    const profileKey = 'mirrorvault:player-profile:v1';
    localStorage.setItem(profileKey, '{"sentinel":true}');
    localStorage.setItem(EDITOR_DRAFT_KEY, '{');
    const result = loadEditorDrafts(evaluationRooms);
    expect(result.recovered).toBe(true);
    expect(Object.keys(result.drafts.rooms)).toHaveLength(5);
    expect(localStorage.getItem(EDITOR_DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem(profileKey)).toBe('{"sentinel":true}');
  });
});
