import { describe, expect, it, vi } from 'vitest';
import { api, ApiError, request } from './api';

describe('same-origin API client', () => {
  it('uses the proxy prefix, JSON bodies and handles a bodyless 204', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.remove('teams', 4)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/teams/4', expect.objectContaining({ method: 'DELETE' }));
    fetch.mockResolvedValue(new Response(JSON.stringify({ id: 2, name: 'New', year: 2026 }), { status: 201 }));
    await expect(api.create('championships', { name: 'New', year: 2026 })).resolves.toMatchObject({ id: 2 });
    expect(fetch).toHaveBeenLastCalledWith('/api/championships', expect.objectContaining({
      method: 'POST', body: '{"name":"New","year":2026}', headers: { 'Content-Type': 'application/json' },
    }));
  });
  it('preserves 400 field errors and 409 conflict detail', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Validation failed', errors: { age: ['Age invalid'] } }), { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    await expect(request('/players')).rejects.toMatchObject({ status: 400, fields: { age: ['Age invalid'] } });
    fetch.mockResolvedValue(new Response(JSON.stringify({ title: 'Conflict', detail: 'Team has games; delete them first.' }), { status: 409 }));
    await expect(api.remove('teams', 1)).rejects.toThrow('Team has games; delete them first.');
  });
  it('distinguishes missing records, proxy errors and connectivity failures', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.get('players', 9)).rejects.toThrow('no longer exists');
    fetch.mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    await expect(request('/teams')).rejects.toThrow('(502)');
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/teams')).rejects.toMatchObject({ status: 0 });
  });
  it('passes query filters and abort signals unchanged', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetch);
    await expect(api.list('player-stats', 'gameId=1&playerId=2', controller.signal)).rejects.not.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledWith('/api/player-stats?gameId=1&playerId=2', expect.objectContaining({ signal: controller.signal }));
  });
});
