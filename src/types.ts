export interface Championship { id: number; name: string; year: number }
export interface Team { id: number; name: string; championshipId: number }
export interface Player { id: number; name: string; age: number; teamId: number }
export interface Game { id: number; date: string; teamAId: number; teamBId: number }
export const positions = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const;
export type Position = typeof positions[number];
export interface PlayerStat {
  id: number; gameId: number; playerId: number; position: Position;
  minutesPlayed: number; starter: boolean; goals: number; assists: number;
}
export interface GameStatLine extends Omit<PlayerStat, 'gameId'> {
  playerName: string; teamId: number;
}
export interface PlayerTotals {
  playerId: number; playerName: string; championshipId: number | null;
  gamesPlayed: number; starts: number; minutesPlayed: number; goals: number; assists: number;
}
export interface Resources {
  championships: Championship; teams: Team; players: Player;
  games: Game; 'player-stats': PlayerStat;
}
export type Resource = keyof Resources;
export type Entity = Resources[Resource];
export type Catalog = { [K in Resource]: Resources[K][] };
export type Payload<K extends Resource> = Omit<Resources[K], 'id'>;
export const resources: Resource[] = ['championships', 'teams', 'players', 'games', 'player-stats'];
export const labels: Record<Resource, { title: string; singular: string; description: string }> = {
  championships: { title: 'Championships', singular: 'championship', description: 'Big dreams. Local legends. Bring your next season to life.' },
  teams: { title: 'Teams', singular: 'team', description: 'The people who make every match worth playing.' },
  players: { title: 'Players', singular: 'player', description: 'Small boots. Endless potential. Meet your next generation.' },
  games: { title: 'Games', singular: 'game', description: 'From the first whistle to the final handshake.' },
  'player-stats': { title: 'Player stats', singular: 'player stat', description: 'Every minute matters. Give every contribution its moment.' },
};

export function entityTitle(resource: Resource, entity: Entity, data: Catalog): string {
  if ('name' in entity) return entity.name;
  if (resource === 'games' && 'teamAId' in entity) return gameTitle(entity, data);
  if ('playerId' in entity) return `${data.players.find(p => p.id === entity.playerId)?.name ?? 'Missing player'} - ${data.games.find(g => g.id === entity.gameId)?.date ?? 'Missing game'}`;
  return 'Record';
}
export const teamName = (id: number, data: Catalog) => data.teams.find(t => t.id === id)?.name ?? `Missing team (#${id})`;
export const championshipName = (id: number, data: Catalog) => data.championships.find(c => c.id === id)?.name ?? `Missing championship (#${id})`;
export const gameTitle = (game: Game, data: Catalog) => `${teamName(game.teamAId, data)} vs ${teamName(game.teamBId, data)}`;
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}
