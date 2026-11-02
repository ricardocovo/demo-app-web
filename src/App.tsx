import { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowUpRight, CalendarDays, Check, ChevronRight, Flag, Goal, Menu, Pencil, Plus, RefreshCw, Search, Shield, Trophy, Users, Trash2 } from 'lucide-react';
import { api } from './api';
import { Detail } from './Detail';
import { DeleteDialog, ResourceForm } from './ResourceForm';
import { useLoad } from './useLoad';
import { Empty, Failure, Loading } from './ui';
import { championshipName, entityTitle, formatDate, gameTitle, labels, resources, teamName, type Catalog, type Entity, type Resource } from './types';

const icons = { championships: Trophy, teams: Shield, players: Users, games: CalendarDays, 'player-stats': Activity };
type Route = { resource: Resource; id?: number };
function readRoute(): Route {
  const [name, id] = window.location.hash.slice(1).split('/');
  return { resource: resources.includes(name as Resource) ? name as Resource : 'championships', id: /^\d+$/.test(id ?? '') ? Number(id) : undefined };
}
export function App() {
  const [route, setRoute] = useState(readRoute);
  const [revision, setRevision] = useState(0);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<{ action: 'edit' | 'delete'; entity?: Entity }>();
  const [success, setSuccess] = useState('');
  const catalog = useLoad(signal => api.catalog(signal), [revision]);
  useEffect(() => {
    const change = () => { setRoute(readRoute()); setMenu(false); setModal(undefined); setSuccess(''); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = `${labels[route.resource].title} | Touchline`;
    document.getElementById('main-content')?.focus();
  }, [route.resource, route.id]);
  useEffect(() => {
    if (success && !catalog.loading) document.getElementById('main-content')?.focus();
  }, [success, catalog.loading]);
  const complete = (deleted = false) => {
    setModal(undefined);
    if (deleted && route.id) window.location.hash = route.resource;
    setSuccess(deleted ? 'Record deleted. Your league is up to date.' : 'Changes saved. Your league is up to date.');
    setRevision(n => n + 1);
  };
  return <>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <header className="site-header"><a className="brand" href="#championships" aria-label="Touchline home"><span className="brand-mark"><Goal size={27} strokeWidth={2} /></span>touchline<span className="brand-dot">.</span></a><span className="header-note">Little league. Big possibilities.</span><div className="header-right"><span className="local-badge"><span /> Local workspace</span><button className="icon-button menu-button" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={22} /></button></div></header>
    <nav className={`navigation ${menu ? 'open' : ''}`} aria-label="Main navigation">
      {resources.map(r => { const Icon = icons[r]; return <a key={r} href={`#${r}`} className={route.resource === r ? 'active' : ''} aria-current={route.resource === r ? 'page' : undefined}><Icon size={20} /><span>{labels[r].title}</span></a>; })}
    </nav>
    <main id="main-content" tabIndex={-1}>
      {success && <div className="success" role="status"><Check size={18} />{success}<button className="text-button" onClick={() => setSuccess('')}>Dismiss</button></div>}
      {catalog.loading ? <Loading /> : catalog.error || !catalog.data ? <Failure error={catalog.error} retry={() => setRevision(n => n + 1)} /> :
        route.id ? <Detail key={`${route.resource}/${route.id}`} resource={route.resource} id={route.id} data={catalog.data} revision={revision} onEdit={entity => setModal({ action: 'edit', entity })} onDelete={entity => setModal({ action: 'delete', entity })} /> :
        <ResourceScreen key={route.resource} resource={route.resource} data={catalog.data} revision={revision} refresh={() => setRevision(n => n + 1)} onCreate={() => setModal({ action: 'edit' })} onEdit={entity => setModal({ action: 'edit', entity })} onDelete={entity => setModal({ action: 'delete', entity })} />}
    </main>
    <footer><a className="footer-brand" href="#championships"><Goal size={18} /> Made for the love of the game.</a><span>Touchline / Little League Soccer</span><span>Trusted local use &middot; No authentication</span></footer>
    {catalog.data && modal?.action === 'edit' && <ResourceForm resource={route.resource} entity={modal.entity} data={catalog.data} onClose={() => setModal(undefined)} onSaved={() => complete()} />}
    {catalog.data && modal?.action === 'delete' && modal.entity && <DeleteDialog resource={route.resource} entity={modal.entity} title={entityTitle(route.resource, modal.entity, catalog.data)} onClose={() => setModal(undefined)} onDeleted={() => complete(true)} />}
  </>;
}

function ResourceScreen({ resource, data, revision, refresh, onCreate, onEdit, onDelete }: {
  resource: Resource; data: Catalog; revision: number; refresh: () => void;
  onCreate: () => void; onEdit: (entity: Entity) => void; onDelete: (entity: Entity) => void;
}) {
  const [search, setSearch] = useState('');
  const [championship, setChampionship] = useState('');
  const [team, setTeam] = useState('');
  const [game, setGame] = useState('');
  const [player, setPlayer] = useState('');
  const [retry, setRetry] = useState(0);
  const params = new URLSearchParams();
  if (resource === 'teams' && championship) params.set('championshipId', championship);
  if (['players', 'games'].includes(resource) && team) params.set('teamId', team);
  if (resource === 'player-stats') {
    if (game) params.set('gameId', game);
    if (player) params.set('playerId', player);
  }
  const query = params.toString();
  const list = useLoad(signal => api.list(resource, query, signal), [resource, query, revision, retry]);
  const scopedTeams = data.teams.filter(t => !championship || t.championshipId === Number(championship));
  const scopedGames = data.games.filter(g => !team || g.teamAId === Number(team) || g.teamBId === Number(team)).filter(g => !championship || scopedTeams.some(t => t.id === g.teamAId));
  const selectedGame = data.games.find(g => g.id === Number(game));
  const scopedPlayers = data.players.filter(p => !selectedGame || p.teamId === selectedGame.teamAId || p.teamId === selectedGame.teamBId);
  const filtered = list.data?.filter(e => {
    if (resource === 'players' && championship && 'teamId' in e && !scopedTeams.some(t => t.id === e.teamId)) return false;
    if (resource === 'games' && championship && 'teamAId' in e && !scopedTeams.some(t => t.id === e.teamAId)) return false;
    return `${entityTitle(resource, e, data)} ${subtitle(e, data)}`.toLowerCase().includes(search.trim().toLowerCase());
  }) ?? [];
  const total = data[resource].length;
  const hasFilters = !!(search || championship || team || game || player);
  const filter = (label: string, value: string, options: { id: number; name: string }[], change: (value: string) => void) =>
    <label className="filter-label">{label}<select aria-label={`Filter ${label.toLowerCase()}`} value={value} onChange={e => change(e.target.value)}><option value="">All {label.toLowerCase()}</option>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="tiny-line" /> Your league, beautifully organized</p><h1>A little less admin.<br />A lot more <span>beautiful game.</span></h1><p>From the season opener to their first goal.<br className="desktop-break" /> Make room for the moments that matter.</p><a className="hero-link" href="#records" onClick={e => { e.preventDefault(); document.getElementById('records')?.scrollIntoView({ behavior: 'smooth' }); }}>Let&apos;s get the ball rolling <ArrowDown size={16} /></a></div>
      <div className="hero-art" aria-hidden="true"><div className="art-label"><Flag size={14} /> THE NEXT GENERATION OF THE GAME</div><div className="pitch"><div className="pitch-center" /><div className="pitch-box left" /><div className="pitch-box right" /><span className="pitch-dot dot-one" /><span className="pitch-dot dot-two" /><span className="pitch-dot dot-three" /><span className="soccer-ball">&#9917;</span></div><div className="art-sticker"><Trophy size={22} /><div>Small teams.<br /><strong>Big dreams.</strong></div></div></div>
    </section>
    <section className="metrics" aria-label="League at a glance">
      {(['championships', 'teams', 'players', 'games'] as Resource[]).map(r => { const Icon = icons[r]; return <a key={r} href={`#${r}`}><span className="metric-icon"><Icon size={20} /></span><span><strong>{data[r].length}</strong><span>{labels[r].title}</span></span><ArrowUpRight size={15} className="metric-arrow" /></a>; })}
    </section>
    <section id="records" className="records">
      <div className="section-heading"><div><p className="eyebrow">THE LEAGUE HUB</p><h2>{labels[resource].title} <span className="count">{total}</span></h2><p className="muted">{labels[resource].description}</p></div><button className="primary" onClick={onCreate}><Plus size={18} /> New {labels[resource].singular}</button></div>
      <div className="filter-bar"><label className="search"><Search size={19} /><span className="sr-only">Search {labels[resource].title.toLowerCase()}</span><input type="search" placeholder={`Search ${labels[resource].title.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} /></label>
        {['teams', 'players', 'games'].includes(resource) && filter('Championships', championship, data.championships, value => { setChampionship(value); setTeam(''); })}
        {['players', 'games'].includes(resource) && filter('Teams', team, scopedTeams, setTeam)}
        {resource === 'player-stats' && <>
          {filter('Games', game, scopedGames.map(g => ({ id: g.id, name: `${gameTitle(g, data)} / ${g.date}` })), value => { setGame(value); setPlayer(''); })}
          {filter('Players', player, scopedPlayers, setPlayer)}
        </>}
        {hasFilters && <button className="text-button" onClick={() => { setSearch(''); setChampionship(''); setTeam(''); setGame(''); setPlayer(''); }}>Clear filters</button>}
        <button className="icon-button bordered refresh" aria-label="Refresh league" onClick={refresh}><RefreshCw size={18} /></button>
      </div>
      {list.loading ? <Loading label={`Loading ${labels[resource].title.toLowerCase()}...`} /> : list.error ? <Failure error={list.error} retry={() => setRetry(n => n + 1)} /> : <>
        <div className="results-meta"><span>{filtered.length} {filtered.length === 1 ? labels[resource].singular : labels[resource].title.toLowerCase()}{hasFilters ? ' found' : ' in your league'}</span><span>Every season starts here</span></div>
        {filtered.length ? <div className={resource === 'championships' || resource === 'teams' ? 'card-grid' : 'record-list'}>{filtered.map(entity => <RecordCard key={entity.id} resource={resource} entity={entity} data={data} onEdit={() => onEdit(entity)} onDelete={() => onDelete(entity)} />)}</div> :
          <Empty title={hasFilters ? 'No matches this time' : `Your next ${labels[resource].singular} starts here`}>{hasFilters ? 'Try another search or clear your filters.' : <>No {labels[resource].title.toLowerCase()} yet. <button className="text-button" onClick={onCreate}>Create your first {labels[resource].singular}</button></>}</Empty>}
      </>}
    </section>
    <aside className="bottom-note"><span className="note-icon"><Goal size={24} /></span><div><strong>More than a league. A place to grow.</strong><p>Keep the details here. Keep your eyes on the game.</p></div><span className="note-end">See you on the sidelines <ChevronRight size={16} /></span></aside>
  </>;
}

function subtitle(entity: Entity, data: Catalog): string {
  if ('year' in entity) return `Season ${entity.year}`;
  if ('championshipId' in entity) return championshipName(entity.championshipId, data);
  if ('age' in entity) return `${teamName(entity.teamId, data)} / Age ${entity.age}`;
  if ('date' in entity) return formatDate(entity.date);
  return `${entity.position} / ${entity.minutesPlayed} min / ${entity.goals} goals / ${entity.assists} assists`;
}
function RecordCard({ resource, entity, data, onEdit, onDelete }: {
  resource: Resource; entity: Entity; data: Catalog; onEdit: () => void; onDelete: () => void;
}) {
  const Icon = icons[resource];
  const title = entityTitle(resource, entity, data);
  const card = resource === 'championships' || resource === 'teams';
  return <article className={card ? `resource-card ${resource}` : 'resource-row'}>
    {card && <a className="card-art" href={`#${resource}/${entity.id}`} tabIndex={-1} aria-hidden="true"><div className="card-art-lines" /><Icon size={48} strokeWidth={1.3} /><span className="art-tag">{'year' in entity ? `SEASON ${entity.year}` : 'THE SQUAD'}</span><span className="art-number">{String(entity.id).padStart(2, '0')}</span></a>}
    {!card && <span className="row-icon"><Icon size={22} /></span>}
    <div className="record-copy"><h3><a href={`#${resource}/${entity.id}`}>{title}</a></h3><p>{subtitle(entity, data)}</p>
      {resource === 'championships' && <span className="record-meta">{data.teams.filter(t => 'year' in entity && t.championshipId === entity.id).length} teams &middot; Ready for the next chapter</span>}
      {resource === 'teams' && <span className="record-meta">{data.players.filter(p => p.teamId === entity.id).length} players &middot; {data.games.filter(g => g.teamAId === entity.id || g.teamBId === entity.id).length} games</span>}
    </div>
    <div className="record-actions"><a className="view-link" href={`#${resource}/${entity.id}`}>View {card ? 'details' : ''}<ArrowUpRight size={16} /><span className="sr-only"> for {title}</span></a><button className="icon-button" aria-label={`Edit ${title}`} onClick={onEdit}><Pencil size={16} /></button><button className="icon-button" aria-label={`Delete ${title}`} onClick={onDelete}><Trash2 size={16} /></button></div>
  </article>;
}
