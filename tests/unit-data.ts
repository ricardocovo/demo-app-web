import type { Catalog } from '../src/types';

export const data: Catalog = {
  championships: [{ id: 1, name: 'Summer', year: 2026 }, { id: 2, name: 'Winter', year: 2026 }],
  teams: [{ id: 1, name: 'Foxes', championshipId: 1 }, { id: 2, name: 'Owls', championshipId: 1 }, { id: 3, name: 'Bears', championshipId: 2 }],
  players: [{ id: 1, name: 'Alex', age: 10, teamId: 1 }, { id: 2, name: 'Sam', age: 12, teamId: 3 }],
  games: [{ id: 1, date: '2026-07-14', teamAId: 1, teamBId: 2 }],
  'player-stats': [],
};
