import { useEffect, useState, type ReactNode } from 'react';
import { AdventureContext } from './adventureContext';
import {
  loadCharacter,
  loadSettings,
  saveCharacter,
  saveSettings,
} from '../services/storage';
import type { UserSettings } from '../types/adventure';

export function AdventureProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterId] = useState(loadCharacter);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => saveCharacter(characterId), [characterId]);
  useEffect(() => saveSettings(settings), [settings]);

  return (
    <AdventureContext.Provider value={{ characterId, setCharacterId, settings, setSettings }}>
      {children}
    </AdventureContext.Provider>
  );
}
