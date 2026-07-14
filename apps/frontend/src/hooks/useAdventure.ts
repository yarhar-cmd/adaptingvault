import { useContext } from 'react';
import { AdventureContext } from '../context/adventureContext';

export function useAdventure() {
  const context = useContext(AdventureContext);
  if (!context) throw new Error('useAdventure must be used inside AdventureProvider.');
  return context;
}
