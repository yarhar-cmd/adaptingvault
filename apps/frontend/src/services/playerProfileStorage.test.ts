import { beforeEach, describe, expect, it } from 'vitest';
import {
  changeExperiencePreset,
  createPlayerProfile,
  loadPlayerProfile,
  parsePlayerProfile,
  resetPlayerProfile,
  savePlayerProfile,
} from './playerProfileStorage';

describe('Resonant Ruins player profile persistence', () => {
  beforeEach(() => localStorage.clear());
  it('persists preset, shortcut, long-term traits, and metadata separately', () => {
    const profile = { ...createPlayerProfile('new-delver'), shortcutUnlocked: true };
    expect(savePlayerProfile(profile)).toBeNull();
    expect(loadPlayerProfile()).toEqual({ record: profile, issue: null });
  });
  it('clamps valid numeric traits and rejects corrupt versions', () => {
    expect(
      parsePlayerProfile({
        ...createPlayerProfile('new-delver'),
        longTermProfile: {
          pace: 2,
          caution: -1,
          aggression: 0.5,
          hazardTolerance: 0.5,
          exploration: 0.5,
        },
      })?.longTermProfile,
    ).toMatchObject({ pace: 1, caution: 0 });
    expect(parsePlayerProfile({ ...createPlayerProfile('new-delver'), version: 9 })).toBeNull();
  });
  it('experience changes and profile reset return traits to neutral and relock shortcut', () => {
    const learned = {
      ...createPlayerProfile('new-delver'),
      shortcutUnlocked: true,
      longTermProfile: { pace: 1, caution: 1, aggression: 1, hazardTolerance: 1, exploration: 1 },
    };
    expect(changeExperiencePreset(learned, 'dungeon-veteran')).toMatchObject({
      experiencePreset: 'dungeon-veteran',
      shortcutUnlocked: false,
      longTermProfile: { pace: 0.5 },
    });
    expect(resetPlayerProfile(learned, true)).toMatchObject({
      experiencePreset: 'new-delver',
      firstTimeComplete: false,
      shortcutUnlocked: false,
      longTermProfile: { pace: 0.5 },
    });
  });
});
