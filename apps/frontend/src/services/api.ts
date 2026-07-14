import type { DungeonConfig } from '../types/adventure';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

interface ApiErrorPayload {
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; service: string }>('/api/health'),
  adventures: () => request<unknown[]>('/api/adventures'),
  createAdventure: (config: DungeonConfig) =>
    request('/api/adventures', { method: 'POST', body: JSON.stringify(config) }),
  contact: (payload: { name: string; email: string; message: string }) =>
    request<{ success: boolean; message: string }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
