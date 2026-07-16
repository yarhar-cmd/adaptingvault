import { useCallback, useEffect, useRef } from 'react';
import {
  createActiveRunRecord,
  saveActiveRun,
  type ActiveRunStorageIssue,
} from '../services/activeRunStorage';
import type { CharacterId } from '../services/runArchive';
import type { GameplayState } from '../utils/gameplayState';

interface ActiveRunPersistenceOptions {
  gameplay: GameplayState;
  characterId: CharacterId;
  onIssue: (issue: ActiveRunStorageIssue) => void;
}

export function useActiveRunPersistence({
  gameplay,
  characterId,
  onIssue,
}: ActiveRunPersistenceOptions): () => ActiveRunStorageIssue | null {
  const gameplayRef = useRef(gameplay);
  const characterIdRef = useRef(characterId);
  const onIssueRef = useRef(onIssue);
  const lastWarningAtRef = useRef(Number.NEGATIVE_INFINITY);

  gameplayRef.current = gameplay;
  characterIdRef.current = characterId;
  onIssueRef.current = onIssue;

  const saveNow = useCallback(() => {
    const record = createActiveRunRecord(gameplayRef.current, characterIdRef.current, Date.now());
    if (!record) return null;
    const issue = saveActiveRun(record);
    if (issue && Date.now() - lastWarningAtRef.current >= 3_000) {
      lastWarningAtRef.current = Date.now();
      onIssueRef.current(issue);
    }
    return issue;
  }, []);

  useEffect(() => {
    if (gameplay.status === 'idle') return;
    if (gameplay.status === 'defeated') {
      saveNow();
      return;
    }
    const timer = window.setTimeout(saveNow, 300);
    return () => window.clearTimeout(timer);
  }, [gameplay, saveNow]);

  useEffect(() => {
    if (gameplay.status === 'idle') return;
    const interval = window.setInterval(saveNow, 2_000);
    function handleVisibilityOrUnload() {
      if (document.visibilityState === 'hidden') saveNow();
    }
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('pagehide', saveNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('pagehide', saveNow);
    };
  }, [gameplay.status, saveNow]);

  return saveNow;
}
