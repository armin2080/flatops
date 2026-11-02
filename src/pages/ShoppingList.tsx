import { useEffect, useState } from 'react';
import type { ShoppingListPayload } from '../lib/types';
import { getShoppingList, addShoppingItems, updateShoppingItem, clearShoppingList } from '../lib/api';

interface Props {
  onBack: () => void;
}

export default function ShoppingList({ onBack }: Props) {
  const [list, setList] = useState<ShoppingListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const l = await getShoppingList();
        if (alive) setList(l);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const add = async () => {
    const texts = draft.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (texts.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setList(await addShoppingItems(texts));
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: number) => {
    setError(null);
    try {
      setList(await updateShoppingItem(id, 'toggle'));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    setError(null);
    try {
      setList(await updateShoppingItem(id, 'delete'));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const clear = async (all: boolean) => {
    if (!window.confirm(all ? 'Clear the whole list?' : 'Remove all checked items?')) return;
    setError(null);
    try {
      setList(await clearShoppingList(all));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pending = list?.items.filter((i) => !i.checked) ?? [];
  const done = list?.items.filter((i) => i.checked) ?? [];

  return (
    <div className="page">
      <header className="page__header">
        <button className="link" onClick={onBack}>← Back</button>
        <h1 className="page__title">🛒 Shopping list</h1>
        <span />
      </header>

      <section className="card">
        <div className="add-row">
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add item(s)… (comma-separated)"
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <button className="btn btn--primary" disabled={busy || !draft.trim()} onClick={add}>Add</button>
        </div>
      </section>

      {error && <div className="banner banner--error">{error}</div>}

      {list && list.items.length === 0 ? (
        <div className="card">
          <p className="muted center">The list is empty. Add what you need for this week's shop.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="card">
              <h3 className="card__title">To get ({pending.length})</h3>
              {pending.map((it) => (
                <div className="shop-row" key={it.id}>
                  <button className="shop-check" onClick={() => toggle(it.id)} aria-label="Mark done">☐</button>
                  <span className="shop-text">{it.text}</span>
                  <button className="icon-btn" onClick={() => remove(it.id)} aria-label="Delete">✕</button>
                </div>
              ))}
            </section>
          )}

          {done.length > 0 && (
            <section className="card">
              <h3 className="card__title">Done ({done.length})</h3>
              {done.map((it) => (
                <div className="shop-row shop-row--done" key={it.id}>
                  <button className="shop-check" onClick={() => toggle(it.id)} aria-label="Mark not done">☑</button>
                  <span className="shop-text">{it.text}</span>
                  <button className="icon-btn" onClick={() => remove(it.id)} aria-label="Delete">✕</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {list && list.items.length > 0 && (
        <div className="alloc-row">
          <button className="btn btn--ghost" onClick={() => clear(false)}>Clear checked</button>
          <button className="btn btn--ghost" onClick={() => clear(true)}>Clear all</button>
        </div>
      )}
    </div>
  );
}
