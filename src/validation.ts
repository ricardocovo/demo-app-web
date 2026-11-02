import { positions, type Catalog, type Entity, type Resource } from './types';

export type Draft = Record<string, string | boolean>;
export type FieldErrors = Record<string, string[]>;
export function initialDraft(resource: Resource, entity?: Entity): Draft {
  if (entity) return Object.fromEntries(Object.entries(entity).filter(([key]) => key !== 'id').map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)]));
  switch (resource) {
    case 'championships': return { name: '', year: String(new Date().getFullYear()) };
    case 'teams': return { name: '', championshipId: '' };
    case 'players': return { name: '', age: '', teamId: '' };
    case 'games': return { date: '', teamAId: '', teamBId: '' };
    case 'player-stats': return { gameId: '', playerId: '', position: '', minutesPlayed: '0', starter: false, goals: '0', assists: '0' };
  }
}
export function validate(resource: Resource, draft: Draft, data: Catalog): FieldErrors {
  const errors: FieldErrors = {};
  const add = (field: string, message: string) => { errors[field] = [message]; };
  const integer = (field: string, min: number, max: number, label: string) => {
    const value = Number(draft[field]);
    if (String(draft[field] ?? '').trim() === '' || !Number.isInteger(value) || value < min || value > max) {
      add(field, `${label} must be a whole number between ${min} and ${max}.`);
    }
  };
  const relation = (field: string, ids: number[], label: string) => {
    if (!ids.includes(Number(draft[field]))) add(field, `Choose an available ${label}.`);
  };
  if (['championships', 'teams', 'players'].includes(resource)) {
    const name = String(draft.name).trim();
    if (!name || name.length > 100) add('name', 'Enter a name between 1 and 100 characters.');
  }
  if (resource === 'championships') integer('year', 1900, 2100, 'Year');
  if (resource === 'teams') relation('championshipId', data.championships.map(c => c.id), 'championship');
  if (resource === 'players') {
    integer('age', 3, 18, 'Age');
    relation('teamId', data.teams.map(t => t.id), 'team');
  }
  if (resource === 'games') {
    const date = String(draft.date ?? '');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) add('date', 'Enter a valid game date.');
    relation('teamAId', data.teams.map(t => t.id), 'home team');
    relation('teamBId', data.teams.map(t => t.id), 'away team');
    const a = data.teams.find(t => t.id === Number(draft.teamAId));
    const b = data.teams.find(t => t.id === Number(draft.teamBId));
    if (a && b && (a.id === b.id || a.championshipId !== b.championshipId)) add('teamBId', 'Choose a different team in the same championship.');
  }
  if (resource === 'player-stats') {
    relation('gameId', data.games.map(g => g.id), 'game');
    const game = data.games.find(g => g.id === Number(draft.gameId));
    const eligible = data.players.filter(p => game && (p.teamId === game.teamAId || p.teamId === game.teamBId));
    relation('playerId', eligible.map(p => p.id), 'player from a participating team');
    if (!positions.some(p => p === draft.position)) add('position', 'Choose a position.');
    integer('minutesPlayed', 0, 120, 'Minutes');
    integer('goals', 0, 2147483647, 'Goals');
    integer('assists', 0, 2147483647, 'Assists');
  }
  return errors;
}
