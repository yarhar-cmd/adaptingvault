import { createContext } from 'react';
import type { UserSettings } from '../types/adventure';

export interface AdventureContextValue {
  characterId: string;
  setCharacterId: (value: string) => void;
  settings: UserSettings;
  setSettings: (value: UserSettings) => void;
}

export const AdventureContext = createContext<AdventureContextValue | null>(null);
