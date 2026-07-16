import { createContext } from 'react';
import type { UserSettings } from '../types/adventure';
import type { PlayerProfileRecord } from '../types/adaptation';

export interface AdventureContextValue {
  characterId: string;
  setCharacterId: (value: string) => void;
  settings: UserSettings;
  setSettings: (value: UserSettings) => void;
  playerProfile: PlayerProfileRecord | null;
  setPlayerProfile: (value: PlayerProfileRecord | null) => void;
}

export const AdventureContext = createContext<AdventureContextValue | null>(null);
