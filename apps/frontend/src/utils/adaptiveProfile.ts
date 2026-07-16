import type {
  AdaptiveProfile,
  AdaptiveRunState,
  PlayerBehaviorSignals,
  RoomBehaviorSnapshot,
} from '../types/adaptation';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';

const TRAITS = ['pace', 'caution', 'aggression', 'hazardTolerance', 'exploration'] as const;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
}

export function createBehaviorSignals(): PlayerBehaviorSignals {
  return {
    roomTimesMs: [],
    movementSteps: 0,
    blockedMovementAttempts: 0,
    idleTimeMs: 0,
    damageTaken: 0,
    runeContacts: 0,
    shieldActivations: 0,
    shieldTimeMs: 0,
    swordSwings: 0,
    floorTilesVisited: [],
    directionChanges: 0,
    exitsChosenByDirection: { north: 0, south: 0, east: 0, west: 0 },
  };
}

export function createAdaptiveRunState(longTerm = NEUTRAL_ADAPTIVE_PROFILE): AdaptiveRunState {
  const signals = createBehaviorSignals();
  return {
    signals,
    generatedRoomSignals: [],
    currentRunProfile: { ...NEUTRAL_ADAPTIVE_PROFILE },
    effectiveProfile: blendProfiles(longTerm, NEUTRAL_ADAPTIVE_PROFILE, 0.5),
    shieldStartedAt: null,
    lastMeaningfulActionAt: null,
    currentRoomSignalBaseline: createBehaviorSignals(),
  };
}

function normalizedRate(value: number, high: number): number {
  return clamp01(value / Math.max(1, high));
}

export function interpretBehaviorSignals(signals: PlayerBehaviorSignals): AdaptiveProfile {
  const roomCount = Math.max(1, signals.roomTimesMs.length);
  const averageRoomMs = signals.roomTimesMs.reduce((sum, value) => sum + value, 0) / roomCount;
  const steps = Math.max(1, signals.movementSteps);
  const visited = signals.floorTilesVisited.length;
  const shieldRate = normalizedRate(signals.shieldActivations, roomCount * 3);
  const shieldDuration = normalizedRate(
    signals.shieldTimeMs,
    Math.max(1, averageRoomMs * roomCount),
  );
  const damageAvoidance = 1 - normalizedRate(signals.damageTaken, roomCount * 2);
  const pace = clamp01(
    0.55 * (1 - normalizedRate(averageRoomMs || 30_000, 60_000)) +
      0.3 * normalizedRate(steps, roomCount * 35) +
      0.15 * (1 - normalizedRate(signals.idleTimeMs, Math.max(1, averageRoomMs * roomCount))),
  );
  const caution = clamp01(0.4 * shieldRate + 0.25 * shieldDuration + 0.35 * damageAvoidance);
  const aggression = clamp01(
    0.65 * normalizedRate(signals.swordSwings, roomCount * 5) +
      0.2 * (1 - shieldRate) +
      0.15 * pace,
  );
  const hazardTolerance = clamp01(
    0.45 * normalizedRate(signals.runeContacts, roomCount * 2) +
      0.25 * normalizedRate(signals.damageTaken, roomCount * 2) +
      0.3 * damageAvoidance,
  );
  const exploration = clamp01(
    0.55 * normalizedRate(visited, Math.max(8, roomCount * 20)) +
      0.3 * normalizedRate(signals.directionChanges, roomCount * 10) +
      0.15 * (1 - pace),
  );
  return { pace, caution, aggression, hazardTolerance, exploration };
}

export function blendProfiles(
  left: AdaptiveProfile,
  right: AdaptiveProfile,
  rightWeight: number,
): AdaptiveProfile {
  const weight = clamp01(rightWeight);
  return Object.fromEntries(
    TRAITS.map((trait) => [trait, clamp01(left[trait] * (1 - weight) + right[trait] * weight)]),
  ) as unknown as AdaptiveProfile;
}

function combineSignals(items: readonly PlayerBehaviorSignals[]): PlayerBehaviorSignals {
  const combined = createBehaviorSignals();
  const visited = new Set<string>();
  for (const signals of items) {
    combined.roomTimesMs.push(...signals.roomTimesMs);
    combined.movementSteps += signals.movementSteps;
    combined.blockedMovementAttempts += signals.blockedMovementAttempts;
    combined.idleTimeMs += signals.idleTimeMs;
    combined.damageTaken += signals.damageTaken;
    combined.runeContacts += signals.runeContacts;
    combined.shieldActivations += signals.shieldActivations;
    combined.shieldTimeMs += signals.shieldTimeMs;
    combined.swordSwings += signals.swordSwings;
    combined.directionChanges += signals.directionChanges;
    for (const tile of signals.floorTilesVisited) visited.add(tile);
    for (const direction of ['north', 'south', 'east', 'west'] as const) {
      combined.exitsChosenByDirection[direction] += signals.exitsChosenByDirection[direction];
    }
  }
  combined.floorTilesVisited = [...visited];
  return combined;
}

export function updateCurrentRunProfile(
  wholeRunSignals: PlayerBehaviorSignals,
  generatedRoomSignals: readonly RoomBehaviorSnapshot[],
): AdaptiveProfile {
  const whole = interpretBehaviorSignals(wholeRunSignals);
  const recent = interpretBehaviorSignals(
    combineSignals(generatedRoomSignals.slice(-5).map((item) => item.signals)),
  );
  return generatedRoomSignals.length === 0 ? whole : blendProfiles(whole, recent, 0.7);
}

export function updateLongTermProfile(
  longTerm: AdaptiveProfile,
  currentRun: AdaptiveProfile,
): AdaptiveProfile {
  return blendProfiles(longTerm, currentRun, 0.12);
}

export function getAdaptationStrength(dungeonRoomNumber: number): number {
  if (dungeonRoomNumber <= 10) return 0.25;
  if (dungeonRoomNumber <= 20) return 0.5;
  if (dungeonRoomNumber <= 30) return 0.75;
  return 1;
}

export function getEffectiveProfile(
  longTerm: AdaptiveProfile,
  currentRun: AdaptiveProfile,
  dungeonRoomNumber: number,
): AdaptiveProfile {
  const learned = blendProfiles(longTerm, currentRun, 0.5);
  return blendProfiles(NEUTRAL_ADAPTIVE_PROFILE, learned, getAdaptationStrength(dungeonRoomNumber));
}

export function subtractSignals(
  current: PlayerBehaviorSignals,
  baseline: PlayerBehaviorSignals,
): PlayerBehaviorSignals {
  const visitedBefore = new Set(baseline.floorTilesVisited);
  return {
    roomTimesMs: current.roomTimesMs.slice(baseline.roomTimesMs.length),
    movementSteps: Math.max(0, current.movementSteps - baseline.movementSteps),
    blockedMovementAttempts: Math.max(
      0,
      current.blockedMovementAttempts - baseline.blockedMovementAttempts,
    ),
    idleTimeMs: Math.max(0, current.idleTimeMs - baseline.idleTimeMs),
    damageTaken: Math.max(0, current.damageTaken - baseline.damageTaken),
    runeContacts: Math.max(0, current.runeContacts - baseline.runeContacts),
    shieldActivations: Math.max(0, current.shieldActivations - baseline.shieldActivations),
    shieldTimeMs: Math.max(0, current.shieldTimeMs - baseline.shieldTimeMs),
    swordSwings: Math.max(0, current.swordSwings - baseline.swordSwings),
    floorTilesVisited: current.floorTilesVisited.filter((tile) => !visitedBefore.has(tile)),
    directionChanges: Math.max(0, current.directionChanges - baseline.directionChanges),
    exitsChosenByDirection: {
      north: Math.max(
        0,
        current.exitsChosenByDirection.north - baseline.exitsChosenByDirection.north,
      ),
      south: Math.max(
        0,
        current.exitsChosenByDirection.south - baseline.exitsChosenByDirection.south,
      ),
      east: Math.max(0, current.exitsChosenByDirection.east - baseline.exitsChosenByDirection.east),
      west: Math.max(0, current.exitsChosenByDirection.west - baseline.exitsChosenByDirection.west),
    },
  };
}
