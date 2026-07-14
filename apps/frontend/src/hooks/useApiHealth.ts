import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useApiHealth() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
    return () => controller.abort();
  }, []);

  return online;
}
