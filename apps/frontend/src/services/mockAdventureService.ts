import type { AdventureScene, Character, DungeonConfig, RunRecord } from '../types/adventure';

export const characters: Character[] = [
  {
    id: 'warden',
    name: 'Elian Voss',
    role: 'The Warden',
    sigil: 'W',
    description: 'A disciplined sentinel who reads danger before it moves.',
    trait: 'Shield timing reveals fewer traps.',
    health: 6,
  },
  {
    id: 'seeker',
    name: 'Mara Quill',
    role: 'The Seeker',
    sigil: 'Q',
    description: 'A vault cartographer drawn to alternate paths and old runes.',
    trait: 'Hidden routes remain visible longer.',
    health: 5,
  },
  {
    id: 'ember',
    name: 'Iven Ash',
    role: 'The Ember',
    sigil: 'A',
    description: 'A relentless duelist who turns pressure into momentum.',
    trait: 'Successive attacks shorten cooldowns.',
    health: 5,
  },
];

const scenes: AdventureScene[] = [
  {
    title: 'A Door That Remembers',
    chamber: 'Vault Chamber 01',
    narrative:
      'The first room holds its breath. A brass rune flickers beyond two sentries, while a narrow arch waits in the eastern wall.',
    choices: [
      { id: 'rune', label: 'Cross toward the rune', tone: 'curious' },
      { id: 'fight', label: 'Challenge the sentries', tone: 'bold' },
      { id: 'edge', label: 'Trace the chamber edge', tone: 'cautious' },
    ],
  },
  {
    title: 'The Listening Floor',
    chamber: 'Vault Chamber 02',
    narrative:
      'Tiles answer every footfall with a second, quieter step. The vault is learning whether patience or momentum carries you forward.',
    choices: [
      { id: 'listen', label: 'Wait for the echo', tone: 'cautious' },
      { id: 'dash', label: 'Move before it settles', tone: 'bold' },
      { id: 'mark', label: 'Mark the repeating tiles', tone: 'curious' },
    ],
  },
  {
    title: 'The Divided Reward',
    chamber: 'Vault Chamber 03',
    narrative:
      'A small iron coffer rests beside the exit. Opening it will wake the room, but leaving it untouched may teach the vault just as much.',
    choices: [
      { id: 'leave', label: 'Leave the coffer sealed', tone: 'cautious' },
      { id: 'open', label: 'Open it without delay', tone: 'bold' },
      { id: 'inspect', label: 'Study its mechanism', tone: 'curious' },
    ],
  },
];

export async function createMockAdventure(
  config: DungeonConfig,
  roomIndex: number,
): Promise<AdventureScene> {
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  return getMockAdventure(config, roomIndex);
}

export function getMockAdventure(config: DungeonConfig, roomIndex: number): AdventureScene {
  const base = scenes[roomIndex % scenes.length];
  if (!base) throw new Error('No mock chamber is available.');

  if (roomIndex >= 3 && config.mode === 'adaptive') {
    return {
      ...base,
      chamber: `Adaptive Chamber ${String(roomIndex + 1).padStart(2, '0')}`,
      narrative: `${base.narrative} Its shape now favors ${config.playstyle} decisions at ${config.challenge} pressure.`,
    };
  }
  return { ...base, chamber: `Vault Chamber ${String(roomIndex + 1).padStart(2, '0')}` };
}

export function makeRunRecord(
  config: DungeonConfig,
  character: Character,
  decisions: string[],
  roomsCleared: number,
): RunRecord {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    character: character.name,
    mode: config.mode,
    challenge: config.challenge,
    outcome: roomsCleared >= 6 ? 'Vault interpreted' : 'Run preserved locally',
    roomsCleared,
    decisions,
  };
}
