import { useEffect, useState } from 'react';
import type { AnalyticsPayload } from '../lib/types';
import { getAnalytics } from '../lib/api';
import { formatCents } from '../lib/money';

interface Props {
  onBack: () => void;
}

export default function Analytics({ onBack }: Props) {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [month, setMonth] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getAnalytics(month);
        if (!alive) return;
        setData(d);
        // Default to the latest available month once we know it.
        if (month === 'all' && d.availableMonths.length > 0) {
          setMonth(d.availableMonths[d.availableMonths.length - 1]);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  if (error) return <div className="center"><p className="error">{error}</p><button className="btn" onClick={onBack}>Back</button></div>;
  if (!data) return <div className="center"><p className="muted">Loading analytics…</p></div>;

  const byCategory = data.byCategory || {};
  const entries = data.categories
    .map((c) => ({ category: c, cents: byCategory[c.id] || 0 }))
    .filter((e) => e.cents !== 0)
    .sort((a, b) => b.cents - a.cents);

  const maxAbs = Math.max(1, ...entries.map((e) => Math.abs(e.cents)));

  const monthLabel = data.month
    ? new Date(`${data.month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'All time';

  return (
    <div className="page">
      <header className="page__header">
        <button className="link" onClick={onBack}>← Back</button>
        <h1 className="page__title">📊 Analytics</h1>
        <span />
      </header>

      <section className="card">
        <label className="field">
          <span className="field__label">Period</span>
          <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All time</option>
            {data.availableMonths.map((m) => (
              <option key={m} value={m}>
                {new Date(`${m}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="kv"><span>Total spent ({monthLabel})</span><strong>{formatCents(data.totalCents)}</strong></div>
        <div className="kv"><span>{data.nameA} share</span><strong>{formatCents(data.aShareCents)}</strong></div>
        <div className="kv"><span>{data.nameB} share</span><strong>{formatCents(data.bShareCents)}</strong></div>
      </section>

      <section className="card">
        <h3 className="card__title">By category</h3>
        {entries.length === 0 ? (
          <p className="muted">No confirmed spending in this period yet.</p>
        ) : (
          entries.map(({ category, cents }) => (
            <div className="bar-row" key={category.id}>
              <div className="bar-row__head">
                <span>{category.emoji} {category.label}</span>
                <strong>{formatCents(cents)}</strong>
              </div>
              <div className="bar-track">
                <div
                  className={`bar-fill ${cents < 0 ? 'bar-fill--neg' : ''}`}
                  style={{ width: `${(Math.abs(cents) / maxAbs) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h3 className="card__title">Each person's top categories</h3>
        <PersonBreakdown name={data.nameA} byCategory={data.aShareByCategory} categories={data.categories} />
        <PersonBreakdown name={data.nameB} byCategory={data.bShareByCategory} categories={data.categories} />
      </section>
    </div>
  );
}

function PersonBreakdown({ name, byCategory, categories }: {
  name: string;
  byCategory: Record<string, number>;
  categories: AnalyticsPayload['categories'];
}) {
  const rows = categories
    .map((c) => ({ category: c, cents: byCategory[c.id] || 0 }))
    .filter((e) => e.cents !== 0)
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 5);

  return (
    <div className="person-breakdown">
      <div className="kv"><span>{name}</span><strong>{formatCents(Object.values(byCategory).reduce((s, v) => s + v, 0))}</strong></div>
      {rows.length === 0 ? (
        <p className="muted small">No spending yet.</p>
      ) : (
        rows.map(({ category, cents }) => (
          <div className="kv kv--sub" key={category.id}>
            <span>{category.emoji} {category.label}</span>
            <strong>{formatCents(cents)}</strong>
          </div>
        ))
      )}
    </div>
  );
}
