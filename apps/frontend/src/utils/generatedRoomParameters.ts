import {
  EXPERIENCE_PRESETS,
  type AdaptiveProfile,
  type ExperiencePreset,
} from '../types/adaptation';
import type { GeneratedRoomMode, GeneratedRoomParameters } from '../types/generation';
import { clamp01 } from './adaptiveProfile';
import { createSeededRandom } from './seededRandom';

export function chooseGeneratedRoomMode(input: {
  runSeed: string;
  dungeonRoomNumber: number;
  experiencePreset: ExperiencePreset;
  previousMode: Exclude<GeneratedRoomMode, 'fallback'> | null;
  pokeCooldown: number;
}): { mode: 'reinforce' | 'poke'; nextPokeCooldown: number } {
  if (input.pokeCooldown > 0) {
    return { mode: 'reinforce', nextPokeCooldown: input.pokeCooldown - 1 };
  }
  if (input.previousMode === 'poke') {
    const cooldownRandom = createSeededRandom(
      `${input.runSeed}:poke-cooldown:${input.dungeonRoomNumber}`,
    );
    const reinforcementRooms = 3 + Math.floor(cooldownRandom() * 3);
    return { mode: 'reinforce', nextPokeCooldown: reinforcementRooms - 1 };
  }
  const random = createSeededRandom(`${input.runSeed}:poke:${input.dungeonRoomNumber}`);
  const poke = random() < EXPERIENCE_PRESETS[input.experiencePreset].pokeBias;
  return { mode: poke ? 'poke' : 'reinforce', nextPokeCooldown: 0 };
}

export function createGeneratedRoomParameters(
  profile: AdaptiveProfile,
  mode: 'reinforce' | 'poke',
  experiencePreset: ExperiencePreset,
): { parameters: GeneratedRoomParameters; reasons: string[] } {
  const tuning = EXPERIENCE_PRESETS[experiencePreset];
  const effective =
    mode === 'reinforce'
      ? profile
      : {
          pace: 1 - profile.pace,
          caution: 1 - profile.caution,
          aggression: 1 - profile.aggression,
          hazardTolerance: 1 - profile.hazardTolerance,
          exploration: 1 - profile.exploration,
        };
  const scale = clamp01((effective.pace + effective.exploration) / 2);
  const hazard = clamp01(effective.hazardTolerance * 0.65 + effective.aggression * 0.2);
  const reasons: string[] = [];
  if (scale > 0.6) reasons.push('Large room: pace + exploration');
  if (effective.exploration > 0.6) reasons.push('L-shape and extra exits: exploration');
  if (hazard < 0.4) reasons.push('Low hazard count: low hazard tolerance');
  if (mode === 'poke' && profile.caution > 0.6) reasons.push('Narrower safe route: caution poke');
  if (mode === 'reinforce' && profile.exploration > 0.6)
    reasons.push('L-shape: exploration reinforcement');

  const minWidth = Math.round(9 + scale * 4);
  const maxWidth = Math.round(15 + scale * 6);
  const minHeight = Math.round(9 + scale * 2);
  const maxHeight = Math.round(11 + scale * 4);
  const lShapeWeight = clamp01(0.35 + (effective.exploration - 0.5) * 0.5);
  const threeExits = clamp01(0.12 + effective.exploration * 0.3);
  const twoExits = clamp01(0.28 + effective.exploration * 0.25);
  const maxHazards = Math.max(0, Math.round(1 + hazard * 7 + tuning.pokeBias * 2));

  return {
    parameters: {
      mode,
      shapeWeights: { rectangle: 1 - lShapeWeight, lShape: lShapeWeight },
      minWidth: Math.max(9, Math.min(21, minWidth)),
      maxWidth: Math.max(9, Math.min(21, maxWidth)),
      minHeight: Math.max(9, Math.min(15, minHeight)),
      maxHeight: Math.max(9, Math.min(15, maxHeight)),
      exitCountWeights: { 1: 1 - twoExits, 2: twoExits, 3: threeExits },
      hazardCountRange: { min: hazard > 0.72 ? 1 : 0, max: maxHazards },
      hazardPatternWeights: {
        scattered: 0.75 - hazard * 0.25,
        clustered: 0.25 + hazard * 0.25,
      },
      safePathPreference:
        mode === 'poke' && profile.caution > 0.55
          ? 'narrow'
          : profile.caution > 0.6
            ? 'wide'
            : 'neutral',
    },
    reasons,
  };
}
