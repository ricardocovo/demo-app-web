import type { Page } from '@playwright/test';

type Row = { id: number; [key: string]: unknown };
export type Database = Record<string, Row[]>;
export const seed: Database = {
  championships: [{ id: 1, name: 'Summer League', year: 2026 }, { id: 2, name: 'Autumn Cup', year: 2026 }, { id: 3, name: 'Spring Juniors', year: 2027 }],
  teams: [{ id: 1, name: 'Riverside Foxes', championshipId: 1 }, { id: 2, name: 'Oakwood Owls', championshipId: 1 }, { id: 3, name: 'Northside Bears', championshipId: 2 }],
  players: [{ id: 1, name: 'Alex Morgan', age: 10, teamId: 1 }, { id: 2, name: 'Jamie Rivera', age: 11, teamId: 2 }, { id: 3, name: 'Sam Taylor', age: 12, teamId: 3 }],
  games: [{ id: 1, date: '2026-07-14', teamAId: 1, teamBId: 2 }],
  'player-stats': [{ id: 1, gameId: 1, playerId: 1, position: 'Forward', minutesPlayed: 60, starter: true, goals: 2, assists: 1 }],
};

/** Deterministic API double; no fixture records are included in the running application. */
export async function mockApi(page: Page, initial: Database = seed) {
  const db = structuredClone(initial);
  const calls: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const parts = url.pathname.replace('/api/', '').split('/').filter(Boolean);
    const [resource, rawId, relationship] = parts;
    const rows = db[resource];
    const id = Number(rawId);
    const method = route.request().method();
    calls.push(`${method} ${url.pathname}${url.search}`);
    const reply = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    const conflict = (detail: string) => reply({ title: 'Conflict', status: 409, detail }, 409);
    if (!rows) return reply({}, 404);
    const record = rows.find(row => row.id === id);
    if (rawId && !record) return route.fulfill({ status: 404 });
    if (method === 'GET') {
      if (relationship === 'teams') return reply(db.teams.filter(t => t.championshipId === id));
      if (relationship === 'players') return reply(db.players.filter(p => p.teamId === id).sort((a, b) => String(a.name).localeCompare(String(b.name))));
      if (relationship === 'games') return reply(db.games.filter(g => g.teamAId === id || g.teamBId === id));
      if (relationship === 'stats') return reply(db['player-stats'].filter(s => s.gameId === id).map(s => {
        const player = db.players.find(p => p.id === s.playerId)!;
        const { gameId: _, ...stat } = s;
        return { ...stat, playerName: player.name, teamId: player.teamId };
      }));
      if (relationship === 'totals') {
        const championshipId = Number(url.searchParams.get('championshipId')) || null;
        const stats = db['player-stats'].filter(s => s.playerId === id && (!championshipId || db.games.some(g => g.id === s.gameId && db.teams.some(t => t.id === g.teamAId && t.championshipId === championshipId))));
        const sum = (key: string) => stats.reduce((total, s) => total + Number(s[key]), 0);
        return reply({ playerId: id, playerName: record!.name, championshipId, gamesPlayed: stats.length, starts: stats.filter(s => s.starter).length, minutesPlayed: sum('minutesPlayed'), goals: sum('goals'), assists: sum('assists') });
      }
      if (rawId) return reply(record);
      return reply(rows.filter(row => {
        for (const [key, value] of url.searchParams) {
          if (key === 'teamId' && resource === 'games') {
            if (row.teamAId !== Number(value) && row.teamBId !== Number(value)) return false;
          } else if (row[key] !== Number(value)) return false;
        }
        return true;
      }));
    }
    if (method === 'DELETE') {
      if (resource === 'championships' && db.teams.some(t => t.championshipId === id)) return conflict('Championship has teams; delete them first.');
      if (resource === 'teams' && db.players.some(p => p.teamId === id)) return conflict('Team has players; delete or move them first.');
      if (resource === 'teams' && db.games.some(g => g.teamAId === id || g.teamBId === id)) return conflict('Team has games; delete them first.');
      if (resource === 'players' && db['player-stats'].some(s => s.playerId === id)) return conflict('Player has recorded stats; delete them first.');
      if (resource === 'games' && db['player-stats'].some(s => s.gameId === id)) return conflict('Game has recorded stats; delete them first.');
      db[resource] = rows.filter(row => row.id !== id);
      return route.fulfill({ status: 204 });
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const errors: Record<string, string[]> = {};
    const invalid = (field: string, message: string) => { errors[field] = [message]; };
    const integer = (field: string, min: number, max: number) => {
      if (!Number.isInteger(body[field]) || Number(body[field]) < min || Number(body[field]) > max) invalid(field, `${field} is out of range.`);
    };
    if (['championships', 'teams', 'players'].includes(resource)) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) invalid('name', 'name is required and must be at most 100 characters.');
    }
    if (resource === 'championships') integer('year', 1900, 2100);
    if (resource === 'teams' && !db.championships.some(c => c.id === body.championshipId)) invalid('championshipId', 'Championship does not exist.');
    if (resource === 'players') {
      integer('age', 3, 18);
      if (!db.teams.some(t => t.id === body.teamId)) invalid('teamId', 'Team does not exist.');
    }
    if (resource === 'games') {
      if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) invalid('date', 'date is required.');
      const a = db.teams.find(t => t.id === body.teamAId);
      const b = db.teams.find(t => t.id === body.teamBId);
      if (!a) invalid('teamAId', 'Team A does not exist.');
      if (!b) invalid('teamBId', 'Team B does not exist.');
      if (a && b && (a.id === b.id || a.championshipId !== b.championshipId)) invalid('teamBId', 'Both teams must be different and belong to the same championship.');
    }
    if (resource === 'player-stats') {
      const game = db.games.find(g => g.id === body.gameId);
      const player = db.players.find(p => p.id === body.playerId);
      if (!game) invalid('gameId', 'Game does not exist.');
      if (!player || !game || ![game.teamAId, game.teamBId].includes(player.teamId)) invalid('playerId', "Player's team did not play in this game.");
      if (!['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].includes(String(body.position))) invalid('position', 'position is required.');
      integer('minutesPlayed', 0, 120); integer('goals', 0, 2147483647); integer('assists', 0, 2147483647);
    }
    if (Object.keys(errors).length) return reply({ title: 'One or more validation errors occurred.', status: 400, errors }, 400);
    if (resource === 'teams' && record && record.championshipId !== body.championshipId && db.games.some(g => g.teamAId === id || g.teamBId === id)) return conflict('Cannot move a team that has games to another championship.');
    if (resource === 'games' && record && (record.teamAId !== body.teamAId || record.teamBId !== body.teamBId) && db['player-stats'].some(s => s.gameId === id)) return conflict('Cannot change teams of a game that has recorded stats.');
    if (resource === 'player-stats' && db['player-stats'].some(s => s.id !== (record?.id ?? 0) && s.gameId === body.gameId && s.playerId === body.playerId)) return conflict('Stats for this player in this game already exist.');
    const next: Row = { ...body, id: record?.id ?? Math.max(0, ...rows.map(r => r.id)) + 1 };
    if (typeof next.name === 'string') next.name = next.name.trim();
    if (record) rows[rows.indexOf(record)] = next;
    else rows.push(next);
    return reply(next, record ? 200 : 201);
  });
  return { db, calls };
}
