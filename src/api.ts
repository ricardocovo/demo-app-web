import type { Catalog, Payload, Resource, Resources } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the soccer API. Check that it is running and try again.', 0);
  }
  if (!response.ok) {
    const text = await response.text();
    let problem: { detail?: string; title?: string; errors?: Record<string, string[]> } = {};
    if (text) {
      try { problem = JSON.parse(text); } catch { /* Non-JSON proxy errors use the explicit status message below. */ }
    }
    const fallback = response.status === 404 ? 'This record no longer exists. Refresh the list to see the latest data.'
      : response.status === 409 ? 'This change conflicts with related records.'
      : response.status === 400 ? 'Please check the highlighted fields.'
      : `The API could not complete this request (${response.status}). Please try again.`;
    throw new ApiError(problem.detail || problem.title || fallback, response.status, problem.errors);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  list: <K extends Resource>(resource: K, query = '', signal?: AbortSignal) =>
    request<Resources[K][]>(`/${resource}${query ? `?${query}` : ''}`, { signal }),
  get: <K extends Resource>(resource: K, id: number, signal?: AbortSignal) =>
    request<Resources[K]>(`/${resource}/${id}`, { signal }),
  create: <K extends Resource>(resource: K, payload: Payload<K>) =>
    request<Resources[K]>(`/${resource}`, { method: 'POST', body: JSON.stringify(payload) }),
  update: <K extends Resource>(resource: K, id: number, payload: Payload<K>) =>
    request<Resources[K]>(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (resource: Resource, id: number) => request<void>(`/${resource}/${id}`, { method: 'DELETE' }),
  async catalog(signal?: AbortSignal): Promise<Catalog> {
    const [championships, teams, players, games, stats] = await Promise.all([
      api.list('championships', '', signal), api.list('teams', '', signal),
      api.list('players', '', signal), api.list('games', '', signal), api.list('player-stats', '', signal),
    ]);
    return { championships, teams, players, games, 'player-stats': stats };
  },
};
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
