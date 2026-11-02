import { useRef, useState, type ReactNode } from 'react';
import { api, ApiError, errorMessage } from './api';
import { championshipName, formatDate, gameTitle, labels, positions, teamName, type Catalog, type Entity, type Position, type Resource } from './types';
import { initialDraft, validate, type Draft, type FieldErrors } from './validation';
import { Modal } from './ui';

interface Props {
  resource: Resource; entity?: Entity; data: Catalog;
  onClose: () => void; onSaved: () => void;
}
type Option = { value: number | string; label: string };

export function ResourceForm({ resource, entity, data, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(resource, entity));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const change = (key: string, value: string | boolean) => {
    setDraft(old => ({ ...old, [key]: value }));
    setErrors(old => { const next = { ...old }; delete next[key]; return next; });
  };
  const field = (key: string, label: string, input: ReactNode) => <div className={`field ${errors[key] ? 'invalid' : ''}`} key={key}>
    <label htmlFor={`field-${key}`}>{label}</label>{input}
    {errors[key] && <span className="field-error" id={`error-${key}`}>{errors[key].join(' ')}</span>}
  </div>;
  const attrs = (key: string) => ({
    id: `field-${key}`, name: key, 'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `error-${key}` : undefined,
  });
  const text = (key: string, label: string, type = 'text', min?: number, max?: number) => field(key, label,
    <input {...attrs(key)} type={type} value={String(draft[key] ?? '')} onChange={e => change(key, e.target.value)}
      maxLength={type === 'text' ? 100 : undefined} min={min} max={max} step={type === 'number' ? 1 : undefined} required />);
  const select = (key: string, label: string, options: Option[]) => {
    const value = String(draft[key] ?? '');
    const unavailable = value !== '' && !options.some(o => String(o.value) === value);
    const currentName = key === 'playerId' ? data.players.find(p => p.id === Number(value))?.name
      : key === 'championshipId' ? data.championships.find(c => c.id === Number(value))?.name
      : ['teamId', 'teamAId', 'teamBId'].includes(key) ? data.teams.find(t => t.id === Number(value))?.name
      : undefined;
    return field(key, label, <select {...attrs(key)} value={value} onChange={e => change(key, e.target.value)} required>
      <option value="">Choose {label.toLowerCase()}</option>
      {unavailable && <option value={value}>Current selection: {currentName ?? `#${value}`} - unavailable; choose again</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>);
  };
  const number = (key: string) => Number(draft[key]);
  const save = async () => {
    const name = String(draft.name ?? '').trim();
    const commit = <K extends Resource,>(kind: K, payload: Parameters<typeof api.create<K>>[1]) =>
      entity ? api.update(kind, entity.id, payload) : api.create(kind, payload);
    switch (resource) {
      case 'championships': return commit('championships', { name, year: number('year') });
      case 'teams': return commit('teams', { name, championshipId: number('championshipId') });
      case 'players': return commit('players', { name, age: number('age'), teamId: number('teamId') });
      case 'games': return commit('games', { date: String(draft.date), teamAId: number('teamAId'), teamBId: number('teamBId') });
      case 'player-stats': return commit('player-stats', {
        gameId: number('gameId'), playerId: number('playerId'), position: draft.position as Position,
        minutesPlayed: number('minutesPlayed'), starter: draft.starter === true, goals: number('goals'), assists: number('assists'),
      });
    }
  };
  const focusError = (fields: FieldErrors) => {
    const key = Object.keys(fields)[0];
    if (key) requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[name="${key}"]`)?.focus());
  };
  const home = data.teams.find(t => t.id === number('teamAId'));
  const game = data.games.find(g => g.id === number('gameId'));
  return <Modal title={`${entity ? 'Edit' : 'New'} ${labels[resource].singular}`} onClose={onClose} busy={busy}>
    <form ref={form} noValidate onSubmit={async e => {
      e.preventDefault();
      if (busy) return;
      const invalid = validate(resource, draft, data);
      setErrors(invalid); setMessage('');
      if (Object.keys(invalid).length) { focusError(invalid); return; }
      setBusy(true);
      try { await save(); onSaved(); }
      catch (error) {
        setMessage(errorMessage(error));
        if (error instanceof ApiError) {
          const fields = Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k[0].toLowerCase() + k.slice(1), v]));
          setErrors(fields); focusError(fields);
        }
      } finally { setBusy(false); }
    }}>
      <div className="modal-body">
        <p className="muted form-intro">A little organization. A lot more game time. All fields are required.</p>
        {message && <div role="alert" className="error-box">{message}</div>}
        {Object.keys(errors).length > 0 && <p role="alert" className="field-error">Please check the highlighted fields.</p>}
        {['championships', 'teams', 'players'].includes(resource) && text('name', 'Name')}
        {resource === 'championships' && text('year', 'Year', 'number', 1900, 2100)}
        {resource === 'teams' && <>
          {select('championshipId', 'Championship', data.championships.map(c => ({ value: c.id, label: `${c.name} / ${c.year}` })))}
          <p className="hint">Teams with scheduled games cannot move to another championship.</p>
        </>}
        {resource === 'players' && <>
          {text('age', 'Age', 'number', 3, 18)}
          {select('teamId', 'Team', data.teams.map(t => ({ value: t.id, label: `${t.name} / ${championshipName(t.championshipId, data)}` })))}
        </>}
        {resource === 'games' && <>
          {text('date', 'Game date', 'date')}
          {select('teamAId', 'Home team', data.teams.map(t => ({ value: t.id, label: `${t.name} / ${championshipName(t.championshipId, data)}` })))}
          {select('teamBId', 'Away team', data.teams.filter(t => !home || (t.id !== home.id && t.championshipId === home.championshipId)).map(t => ({ value: t.id, label: t.name })))}
          <p className="hint">Choose two different teams in the same championship. Games with recorded stats cannot change teams. Existing selections are never changed automatically.</p>
        </>}
        {resource === 'player-stats' && <>
          {select('gameId', 'Game', data.games.map(g => ({ value: g.id, label: `${gameTitle(g, data)} / ${formatDate(g.date)}` })))}
          {select('playerId', 'Player', data.players.filter(p => game && (p.teamId === game.teamAId || p.teamId === game.teamBId)).map(p => ({ value: p.id, label: `${p.name} / ${teamName(p.teamId, data)}` })))}
          <p className="hint">Only players on participating teams are eligible. One stat record per player per game.</p>
          {select('position', 'Position', positions.map(p => ({ value: p, label: p })))}
          <div className="form-grid">{text('minutesPlayed', 'Minutes played', 'number', 0, 120)}{text('goals', 'Goals', 'number', 0, 2147483647)}{text('assists', 'Assists', 'number', 0, 2147483647)}</div>
          <label className="check"><input name="starter" type="checkbox" checked={draft.starter === true} onChange={e => change('starter', e.target.checked)} /> In the starting lineup</label>
        </>}
      </div>
      <div className="modal-footer"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button></div>
    </form>
  </Modal>;
}

export function DeleteDialog({ resource, entity, title, onClose, onDeleted }: {
  resource: Resource; entity: Entity; title: string; onClose: () => void; onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title={`Delete ${labels[resource].singular}?`} busy={busy} onClose={onClose}>
    <div className="modal-body"><p>Are you sure you want to delete <strong>{title}</strong>? This cannot be undone.</p><p className="muted">Related records are never deleted automatically. The API will protect records still in use.</p>{error && <div className="error-box" role="alert">{error}</div>}</div>
    <div className="modal-footer"><button className="secondary" disabled={busy} onClick={onClose} autoFocus>Keep record</button><button className="primary" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await api.remove(resource, entity.id); onDeleted(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
    }}>{busy ? 'Deleting...' : 'Delete record'}</button></div>
  </Modal>;
}
