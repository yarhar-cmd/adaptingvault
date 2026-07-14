export interface AdventureConfig {
  experience: 'new' | 'occasional' | 'veteran';
  challenge: 'relaxed' | 'balanced' | 'demanding';
  playstyle: 'balanced' | 'combat' | 'puzzle' | 'exploration';
  mode: 'adaptive' | 'random';
  characterId: string;
}

export interface Adventure {
  id: string;
  title: string;
  summary: string;
  status: 'sample' | 'prepared';
  config: AdventureConfig;
  createdAt: string;
  generator: 'local-mock';
}
