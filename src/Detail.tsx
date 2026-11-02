import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import { api, request } from './api';
import { useLoad } from './useLoad';
import { Empty, Failure, Loading } from './ui';
import { championshipName, entityTitle, formatDate, gameTitle, labels, teamName, type Catalog, type Entity, type Game, type GameStatLine, type Player, type PlayerTotals, type Resource, type Team } from './types';

interface Bundle { entity: Entity; teams?: Team[]; players?: Player[]; games?: Game[]; stats?: GameStatLine[]; totals?: PlayerTotals }
export function Detail({ resource, id, data, revision, onEdit, onDelete }: {
  resource: Resource; id: number; data: Catalog; revision: number;
  onEdit: (entity: Entity) => void; onDelete: (entity: Entity) => void;
}) {
  const [championship, setChampionship] = useState('');
  const [retry, setRetry] = useState(0);
  const load = useLoad<Bundle>(async signal => {
    const entity = await api.get(resource, id, signal);
    const get = <T,>(path: string) => request<T>(path, { signal });
    switch (resource) {
      case 'championships': return { entity, teams: await get<Team[]>(`/championships/${id}/teams`) };
      case 'teams': {
        const [players, games] = await Promise.all([get<Player[]>(`/teams/${id}/players`), get<Game[]>(`/teams/${id}/games`)]);
        return { entity, players, games };
      }
      case 'players': return { entity, totals: await get<PlayerTotals>(`/players/${id}/totals${championship ? `?championshipId=${championship}` : ''}`) };
      case 'games': return { entity, stats: await get<GameStatLine[]>(`/games/${id}/stats`) };
      default: return { entity };
    }
  }, [resource, id, revision, championship, retry]);
  if (load.loading) return <Loading label={`Loading ${labels[resource].singular}...`} />;
  if (load.error || !load.data) return <><a href={`#${resource}`} className="back"><ArrowLeft size={16} /> Back to {labels[resource].title.toLowerCase()}</a><Failure error={load.error} retry={() => setRetry(n => n + 1)} /></>;
  const { entity, teams, players, games, stats, totals } = load.data;
  const title = entityTitle(resource, entity, data);
  return <section className="detail">
    <a href={`#${resource}`} className="back"><ArrowLeft size={16} /> All {labels[resource].title.toLowerCase()}</a>
    <div className="section-heading"><div><p className="eyebrow">{labels[resource].singular} / overview</p><h1>{title}</h1></div><div className="actions"><button className="secondary" onClick={() => onEdit(entity)}><Pencil size={16} /> Edit</button><button className="icon-button bordered" aria-label={`Delete ${title}`} onClick={() => onDelete(entity)}><Trash2 size={18} /></button></div></div>
    <div className="detail-summary">
      {'year' in entity && <span>Season <strong>{entity.year}</strong></span>}
      {'championshipId' in entity && <a href={`#championships/${entity.championshipId}`}>{championshipName(entity.championshipId, data)} <ArrowUpRight size={14} /></a>}
      {'teamId' in entity && <><a href={`#teams/${entity.teamId}`}>{teamName(entity.teamId, data)} <ArrowUpRight size={14} /></a><span>Age <strong>{entity.age}</strong></span></>}
      {'teamAId' in entity && <><span>{formatDate(entity.date)}</span><a href={`#teams/${entity.teamAId}`}>Home: {teamName(entity.teamAId, data)}</a><a href={`#teams/${entity.teamBId}`}>Away: {teamName(entity.teamBId, data)}</a></>}
      {'position' in entity && <><a href={`#players/${entity.playerId}`}>{data.players.find(p => p.id === entity.playerId)?.name ?? 'Missing player'} <ArrowUpRight size={14} /></a><a href={`#games/${entity.gameId}`}>{data.games.find(g => g.id === entity.gameId) ? gameTitle(data.games.find(g => g.id === entity.gameId)!, data) : 'Missing game'}</a><span>{entity.position}</span><span>{entity.starter ? 'Starter' : 'Substitute'}</span><span>{entity.minutesPlayed} minutes</span><span>{entity.goals} goals</span><span>{entity.assists} assists</span></>}
    </div>
    {teams && <Related title="Teams in this championship" count={teams.length}>
      {teams.length ? <div className="related-grid">{teams.map(t => <RelatedLink key={t.id} href={`#teams/${t.id}`} title={t.name} description="Explore team roster and games" />)}</div> : <Empty>No teams yet. Create a team and choose this championship.</Empty>}
    </Related>}
    {players && <Related title="Team roster" count={players.length}>
      {players.length ? <div className="related-grid">{players.map(p => <RelatedLink key={p.id} href={`#players/${p.id}`} title={p.name} description={`Age ${p.age} / View player totals`} />)}</div> : <Empty>No players on this roster yet. Add a player from the Players screen.</Empty>}
    </Related>}
    {games && <Related title="Team games" count={games.length}>
      {games.length ? <div className="related-grid">{games.map(g => <RelatedLink key={g.id} href={`#games/${g.id}`} title={gameTitle(g, data)} description={formatDate(g.date)} />)}</div> : <Empty>No games scheduled for this team.</Empty>}
    </Related>}
    {totals && <Related title="Player totals">
      <label className="filter-label">Championship<select aria-label="Totals championship" value={championship} onChange={e => setChampionship(e.target.value)}><option value="">All championships</option>{data.championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="totals">{([['Games played', totals.gamesPlayed], ['Starts', totals.starts], ['Minutes', totals.minutesPlayed], ['Goals', totals.goals], ['Assists', totals.assists]] as const).map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    </Related>}
    {stats && <Related title="Game stats" count={stats.length}>
      {stats.length ? <div className="table-scroll"><table><caption className="sr-only">Player statistics for {title}</caption><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>Lineup</th><th>Minutes</th><th>Goals</th><th>Assists</th><th>Record</th></tr></thead><tbody>{stats.map(s => <tr key={s.id}><td><a href={`#players/${s.playerId}`}>{s.playerName}</a></td><td>{teamName(s.teamId, data)}</td><td>{s.position}</td><td>{s.starter ? 'Starter' : 'Substitute'}</td><td>{s.minutesPlayed}</td><td>{s.goals}</td><td>{s.assists}</td><td><a href={`#player-stats/${s.id}`}>View stat</a></td></tr>)}</tbody></table></div> : <Empty>No stats recorded yet. Add a player stat from the Player stats screen.</Empty>}
    </Related>}
  </section>;
}
function Related({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <section className="related-section"><h2>{title} {count !== undefined && <span className="count">{count}</span>}</h2>{children}</section>;
}
function RelatedLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <a className="related-link" href={href}><div><strong>{title}</strong><p>{description}</p></div><ArrowUpRight size={18} /></a>;
}
