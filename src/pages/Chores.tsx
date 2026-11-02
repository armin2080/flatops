import { useCallback, useEffect, useState } from 'react';
import type { Chore, ChoresPayload } from '../lib/types';
import { getChores, saveChore, deleteChore, completeChore } from '../lib/api';

interface Props {
  onBack: () => void;
}

const STATUS_ICON: Record<string, string> = {
  overdue: '🔴',
  due: '🟠',
  upcoming: '📅',
  none: '✅',
};

const STATUS_LABEL: Record<string, string> = {
  overdue: 'Overdue',
  due: 'Due now',
  upcoming: 'Upcoming',
  none: 'On track',
};

export default function Chores({ onBack }: Props) {
  const [data, setData] = useState<ChoresPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Chore | 'new' | null>(null);

  const reload = useCallback(async () => {
    setData(await getChores());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getChores();
        if (alive) setData(d);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const markDone = async (id: number) => {
    setError(null);
    try {
      setData(await completeChore(id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Remove this chore?')) return;
    setError(null);
    try {
      setData(await deleteChore(id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const dueNow = data?.items.filter((c) => c.status === 'due' || c.status === 'overdue') ?? [];
  const upcoming = data?.items.filter((c) => c.status === 'upcoming' || c.status === 'none') ?? [];

  return (
    <div className="page">
      <header className="page__header">
        <button className="link" onClick={onBack}>← Back</button>
        <h1 className="page__title">🧹 Chores</h1>
        <button className="link" onClick={() => setEditing('new')}>+ Add</button>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      {data && data.items.length === 0 && !editing && (
        <div className="card">
          <p className="muted center">
            No chores yet. Add one — e.g. "Clean the bathroom" every week — and
            FlatOps will rotate whose turn it is and remind them.
          </p>
          <button className="btn btn--primary btn--block" onClick={() => setEditing('new')}>+ Add your first chore</button>
        </div>
      )}

      {dueNow.length > 0 && (
        <section className="card">
          <h3 className="card__title">Needs doing</h3>
          {dueNow.map((c) => (
            <ChoreCard key={c.id} chore={c} onDone={() => markDone(c.id)} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />
          ))}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="card">
          <h3 className="card__title">Upcoming</h3>
          {upcoming.map((c) => (
            <ChoreCard key={c.id} chore={c} onDone={() => markDone(c.id)} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />
          ))}
        </section>
      )}

      {editing && (
        <ChoreForm
          chore={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await reload();
            setEditing(null);
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function ChoreCard({ chore, onDone, onEdit, onDelete }: {
  chore: Chore;
  onDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dueDate = new Date(chore.nextDueAt * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <div className="chore">
      <div className="chore__main">
        <span className="chore__icon">{STATUS_ICON[chore.status] || '•'}</span>
        <div className="chore__body">
          <div className="chore__name">
            {chore.name}
            {chore.isActive === false && <span className="muted small"> (paused)</span>}
          </div>
          <div className="muted small">
            {STATUS_LABEL[chore.status] || chore.status} · {chore.frequencyLabel} · {chore.assigneeName ? `${chore.assigneeName}'s turn` : 'unassigned'} · due {dueDate}
          </div>
          {chore.description && <div className="muted small">{chore.description}</div>}
        </div>
      </div>
      <div className="row-actions">
        <button className="icon-btn icon-btn--edit" onClick={onEdit} aria-label="Edit" title="Edit">✏️</button>
        <button className="icon-btn" onClick={onDelete} aria-label="Delete" title="Delete">🗑</button>
      </div>
      {(chore.status === 'due' || chore.status === 'overdue') && (
        <button className="btn btn--primary chore__done" onClick={onDone}>✓ Done</button>
      )}
    </div>
  );
}

function ChoreForm({ chore, onClose, onSaved, onError }: {
  chore: Chore | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(chore?.name ?? '');
  const [description, setDescription] = useState(chore?.description ?? '');
  const [frequencyDays, setFrequencyDays] = useState(chore?.frequencyDays ?? 7);
  const [advanceDays, setAdvanceDays] = useState(chore?.advanceDays ?? 1);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      onError('Give the chore a name.');
      return;
    }
    setBusy(true);
    try {
      await saveChore({
        id: chore?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        frequencyDays,
        advanceDays,
      });
      await onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card--form">
      <h3 className="card__title">{chore ? 'Edit chore' : 'New chore'}</h3>
      <label className="field">
        <span className="field__label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clean the bathroom" />
      </label>
      <label className="field">
        <span className="field__label">Description (optional)</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs doing" />
      </label>
      <label className="field">
        <span className="field__label">How often</span>
        <select className="input" value={frequencyDays} onChange={(e) => setFrequencyDays(Number(e.target.value))}>
          <option value={1}>Every day</option>
          <option value={2}>Every 2 days</option>
          <option value={7}>Every week</option>
          <option value={14}>Every 2 weeks</option>
          <option value={30}>Every month</option>
        </select>
      </label>
      <label className="field">
        <span className="field__label">Remind in advance (days)</span>
        <select className="input" value={advanceDays} onChange={(e) => setAdvanceDays(Number(e.target.value))}>
          <option value={0}>No advance reminder</option>
          <option value={1}>1 day before</option>
          <option value={2}>2 days before</option>
          <option value={3}>3 days before</option>
        </select>
      </label>
      <div className="alloc-row">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save chore'}</button>
      </div>
    </section>
  );
}
