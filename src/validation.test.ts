import { describe, expect, it } from 'vitest';
import { formatDate } from './types';
import { initialDraft, validate } from './validation';
import { data } from '../tests/unit-data';
describe('contract validation', () => {
  it('requires trimmed names, validates length and year bounds', () => {
    expect(validate('championships', { name: '   ', year: '1899' }, data)).toHaveProperty('name');
    expect(validate('championships', { name: 'a'.repeat(101), year: '2101' }, data)).toHaveProperty('year');
    for (const year of ['1900', '2100']) expect(validate('championships', { name: 'Summer', year }, data)).toEqual({});
  });
  it('enforces integer age and relation existence', () => {
    for (const age of ['', '2', '19', '10.5']) expect(validate('players', { name: 'Alex', age, teamId: '1' }, data)).toHaveProperty('age');
    for (const age of ['3', '18']) expect(validate('players', { name: 'Alex', age, teamId: '1' }, data)).toEqual({});
    expect(validate('teams', { name: 'Foxes', championshipId: '99' }, data)).toHaveProperty('championshipId');
  });
  it('requires distinct same-championship teams and a real date-only date', () => {
    for (const teamBId of ['1', '3']) expect(validate('games', { date: '2026-07-14', teamAId: '1', teamBId }, data)).toHaveProperty('teamBId');
    expect(validate('games', { date: '2026-02-30', teamAId: '1', teamBId: '2' }, data)).toHaveProperty('date');
    expect(validate('games', { date: '2024-02-29', teamAId: '1', teamBId: '2' }, data)).toEqual({});
    expect(formatDate('2026-07-14')).toBe('Jul 14, 2026');
  });
  it('validates eligibility, positions and exact stat boundaries', () => {
    const valid = { gameId: '1', playerId: '1', position: 'Forward', minutesPlayed: '120', goals: '0', assists: '2' };
    expect(validate('player-stats', valid, data)).toEqual({});
    for (const [field, value] of [['playerId', '2'], ['position', 'Coach'], ['minutesPlayed', '121'], ['goals', '-1'], ['assists', '0.5']]) {
      expect(validate('player-stats', { ...valid, [field]: value }, data)).toHaveProperty(field);
    }
    expect(validate('player-stats', { ...valid, minutesPlayed: '0' }, data)).toEqual({});
  });
  it('preserves all existing foreign keys and false starter values on edit', () => {
    expect(initialDraft('games', data.games[0])).toEqual({ date: '2026-07-14', teamAId: '1', teamBId: '2' });
    expect(initialDraft('player-stats', { id: 3, gameId: 9, playerId: 7, position: 'Defender', minutesPlayed: 0, starter: false, goals: 0, assists: 0 })).toMatchObject({ gameId: '9', playerId: '7', starter: false });
  });
});
