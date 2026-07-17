import { describe, expect, it } from 'vitest';
import { EXPERIENCE_PRESETS } from '../types/adaptation';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import {
  blendProfiles,
  createBehaviorSignals,
  createCompletedBehaviorSummary,
  getAdaptationStrength,
  addSignalsToSummary,
  interpretBehaviorSignals,
  updateCurrentRunProfile,
  updateLongTermProfile,
} from './adaptiveProfile';
import { chooseGeneratedRoomMode } from './generatedRoomParameters';

describe('Resonant Ruins adaptive profile', () => {
  it('starts neutral, clamps traits, and exposes the required strength ramp', () => {
    expect(Object.values(NEUTRAL_ADAPTIVE_PROFILE)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(
      Object.values(
        blendProfiles(
          NEUTRAL_ADAPTIVE_PROFILE,
          { pace: 4, caution: -2, aggression: 0.5, hazardTolerance: 0.5, exploration: 0.5 },
          1,
        ),
      ).every((value) => value >= 0 && value <= 1),
    ).toBe(true);
    expect([1, 11, 21, 31].map(getAdaptationStrength)).toEqual([0.25, 0.5, 0.75, 1]);
  });
  it('interprets raw signals separately and weights recent five-room behavior 70/30', () => {
    const whole = { ...createBehaviorSignals(), roomTimesMs: [60_000], movementSteps: 2 };
    const recentSignals = { ...createBehaviorSignals(), roomTimesMs: [5_000], movementSteps: 50 };
    const recent = Array.from({ length: 5 }, (_, index) => ({
      roomNumber: index + 1,
      signals: recentSignals,
    }));
    const current = updateCurrentRunProfile(whole, recent);
    const wholeProfile = interpretBehaviorSignals(whole);
    const recentProfile = interpretBehaviorSignals(recentSignals);
    expect(current.pace).toBeCloseTo(wholeProfile.pace * 0.3 + recentProfile.pace * 0.7, 5);
  });
  it('preserves the adaptive formula when completed rooms are compacted into a numeric summary', () => {
    const first = { ...createBehaviorSignals(), roomTimesMs: [60_000], movementSteps: 2 };
    const second = { ...createBehaviorSignals(), roomTimesMs: [5_000], movementSteps: 50 };
    const raw = {
      ...createBehaviorSignals(),
      roomTimesMs: [...first.roomTimesMs, ...second.roomTimesMs],
      movementSteps: first.movementSteps + second.movementSteps,
    };
    const summary = addSignalsToSummary(
      addSignalsToSummary(createCompletedBehaviorSummary(), first),
      second,
    );
    expect(updateCurrentRunProfile(summary, [])).toEqual(updateCurrentRunProfile(raw, []));
  });
  it('blends long-term values conservatively so one update cannot create an extreme jump', () => {
    const result = updateLongTermProfile(NEUTRAL_ADAPTIVE_PROFILE, {
      pace: 1,
      caution: 0,
      aggression: 1,
      hazardTolerance: 0,
      exploration: 1,
    });
    expect(result.pace).toBe(0.56);
    expect(result.caution).toBe(0.44);
  });
  it('uses exact preset tuning and never schedules consecutive poke rooms', () => {
    expect(EXPERIENCE_PRESETS['new-delver']).toMatchObject({
      reinforceBias: 0.85,
      pokeBias: 0.15,
      adaptationRamp: 'slow',
    });
    expect(EXPERIENCE_PRESETS['seasoned-adventurer']).toMatchObject({
      reinforceBias: 0.75,
      pokeBias: 0.25,
      adaptationRamp: 'medium',
    });
    expect(EXPERIENCE_PRESETS['dungeon-veteran']).toMatchObject({
      reinforceBias: 0.65,
      pokeBias: 0.35,
      adaptationRamp: 'fast',
    });
    const afterPoke = chooseGeneratedRoomMode({
      runSeed: 'seed',
      dungeonRoomNumber: 2,
      experiencePreset: 'dungeon-veteran',
      previousMode: 'poke',
      pokeCooldown: 0,
    });
    expect(afterPoke.mode).toBe('reinforce');
    expect(afterPoke.nextPokeCooldown).toBeGreaterThanOrEqual(2);
    expect(afterPoke.nextPokeCooldown).toBeLessThanOrEqual(4);
    expect(
      chooseGeneratedRoomMode({
        runSeed: 'seed',
        dungeonRoomNumber: 3,
        experiencePreset: 'dungeon-veteran',
        previousMode: 'reinforce',
        pokeCooldown: afterPoke.nextPokeCooldown,
      }).mode,
    ).toBe('reinforce');
  });
});
