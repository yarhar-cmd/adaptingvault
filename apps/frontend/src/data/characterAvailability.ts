export const PLAYABLE_CHARACTER_ID = 'warden' as const;

export function isPlayableCharacter(
  characterId: string,
): characterId is typeof PLAYABLE_CHARACTER_ID {
  return characterId === PLAYABLE_CHARACTER_ID;
}

export function getPlayableCharacterId(characterId: string): typeof PLAYABLE_CHARACTER_ID {
  return isPlayableCharacter(characterId) ? characterId : PLAYABLE_CHARACTER_ID;
}
