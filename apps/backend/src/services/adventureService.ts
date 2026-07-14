import { randomUUID } from 'node:crypto';
import type { Adventure, AdventureConfig } from '../types/adventure.js';

const samples: Adventure[] = [
  {
    id: 'sample-resonant-gate',
    title: 'The Resonant Gate',
    summary: 'Three assessment chambers followed by a vault tuned toward exploration.',
    status: 'sample',
    config: {
      experience: 'occasional',
      challenge: 'balanced',
      playstyle: 'exploration',
      mode: 'adaptive',
      characterId: 'seeker',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    generator: 'local-mock',
  },
  {
    id: 'sample-iron-echo',
    title: 'The Iron Echo',
    summary: 'A demanding control run with randomly weighted room composition.',
    status: 'sample',
    config: {
      experience: 'veteran',
      challenge: 'demanding',
      playstyle: 'combat',
      mode: 'random',
      characterId: 'ember',
    },
    createdAt: '2026-01-02T00:00:00.000Z',
    generator: 'local-mock',
  },
];

export function listAdventures(): Adventure[] {
  return samples;
}

export function createAdventure(config: AdventureConfig): Adventure {
  return {
    id: randomUUID(),
    title: config.mode === 'adaptive' ? 'A Vault in Reflection' : 'A Vault by Chance',
    summary: `A ${config.challenge} local mock adventure emphasizing ${config.playstyle} play.`,
    status: 'prepared',
    config,
    createdAt: new Date().toISOString(),
    generator: 'local-mock',
  };
}
