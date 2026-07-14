export type GenerationMode = 'adaptive' | 'random';
export type Challenge = 'relaxed' | 'balanced' | 'demanding';
export type Playstyle = 'balanced' | 'combat' | 'puzzle' | 'exploration';

export interface DungeonConfig {
  experience: 'new' | 'occasional' | 'veteran';
  challenge: Challenge;
  playstyle: Playstyle;
  mode: GenerationMode;
  characterId: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  sigil: string;
  description: string;
  trait: string;
  health: number;
}

export interface StoryChoice {
  id: string;
  label: string;
  tone: 'cautious' | 'bold' | 'curious';
}

export interface AdventureScene {
  title: string;
  chamber: string;
  narrative: string;
  choices: StoryChoice[];
}

export interface RunRecord {
  id: string;
  startedAt: string;
  character: string;
  mode: GenerationMode;
  challenge: Challenge;
  outcome: string;
  roomsCleared: number;
  decisions: string[];
}

export interface UserSettings {
  sound: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}
