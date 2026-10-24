import { useCallback, useEffect, useState } from 'react';
import type { BalanceViewPayload, HistoryPayload } from '../lib/types';
import { getBalance, getHistory, createSettlement, removeReceipt } from '../lib/api';
import { formatCents, parseCents } from '../lib/money';

interface Props {
  onBack: () => void;
}

export default function BalanceView({ onBack }: Props) {
  const [balance, setBalance] = useState<BalanceViewPayload | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [b, h] = await Promise.all([getBalance(), getHistory(30)]);
    setBalance(b);
    setHistory(h);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [b, h] = await Promise.all([getBalance(), getHistory(30)]);
        if (!alive) return;
        setBalance(b);
        setHistory(h);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onRemove = async (id: number) => {
    if (!window.confirm('Permanently remove this receipt?')) return;
    setBusy(true);
    setError(null);
    try {
      await removeReceipt(id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="center"><p className="error">{error}</p><button className="btn" onClick={onBack}>Back</button></div>;

  const b = balance?.balance;
  const parts = balance?.participants ?? [];
  const canSettle = parts.length >= 2;

  return (
    <div className="page">
      <header className="page__header">
        <button className="link" onClick={onBack}>← Back</button>
        <h1 className="page__title">FlatOps</h1>
        <span />
      </header>

      {b && balance && (
        <section className="card card--balance">
          <p className="muted">Current balance</p>
          <div className="balance-line">
            {b.netBalanceCents === 0
              ? 'You are all settled up 🎉'
              : b.netBalanceCents > 0
                ? `${balance.nameB} owes ${balance.nameA}`
                : `${balance.nameA} owes ${balance.nameB}`}
          </div>
          <div className="balance-amount">{formatCents(Math.abs(b.netBalanceCents))}</div>

          <div className="kv"><span>{balance.nameA} paid</span><strong>{formatCents(b.spentACents)}</strong></div>
          <div className="kv"><span>{balance.nameB} paid</span><strong>{formatCents(b.spentBCents)}</strong></div>
          <div className="kv"><span>Shared expenses</span><strong>{formatCents(b.sharedTotalCents)}</strong></div>
        </section>
      )}

      {canSettle && balance && (
        <SettlementForm
          participants={balance.participants}
          nameA={balance.nameA}
          nameB={balance.nameB}
          onDone={reload}
          onError={setError}
        />
      )}

      <section className="card">
        <h3 className="card__title">Recent receipts</h3>
        {!history || history.receipts.length === 0 ? (
          <p className="muted">No receipts yet.</p>
        ) : (
          history.receipts.slice(0, 12).map((r) => (
            <div className="kv" key={r.id}>
              <span className={r.status === 'confirmed' ? '' : 'muted'}>
                {r.status === 'confirmed' ? '✅' : r.status === 'awaiting_review' ? '👀' : r.status === 'cancelled' ? '❌' : '⏳'} {r.store || 'Receipt'}
              </span>
              {r.status !== 'confirmed' ? (
                <button
                  className="icon-btn"
                  disabled={busy}
                  onClick={() => onRemove(r.id)}
                  aria-label="Remove receipt"
                  title="Remove"
                >
                  🗑
                </button>
              ) : (
                <strong>{formatCents(r.printedTotalCents)}</strong>
              )}
            </div>
          ))
        )}
        <p className="muted small">Confirmed receipts are permanent — use "Record settlement" to adjust the balance.</p>
      </section>

      <section className="card">
        <h3 className="card__title">Settlements</h3>
        {!history || history.settlements.length === 0 ? (
          <p className="muted">No settlements yet.</p>
        ) : (
          history.settlements.slice(0, 12).map((s) => (
            <div className="kv" key={s.id}>
              <span>{s.senderName} → {s.receiverName}{s.note ? <span className="muted small"> · {s.note}</span> : null}</span>
              <strong>{formatCents(s.amountCents)}</strong>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function SettlementForm({ participants, nameA, nameB, onDone, onError }: {
  participants: BalanceViewPayload['participants'];
  nameA: string;
  nameB: string;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const a = participants[0]?.id ?? 0;
  const bb = participants[1]?.id ?? 0;
  const [direction, setDirection] = useState<'b2a' | 'a2b'>('b2a');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async () => {
    const cents = parseCents(amount);
    if (cents == null || cents <= 0) {
      onError('Enter a valid positive amount.');
      return;
    }
    const senderId = direction === 'b2a' ? bb : a;
    const receiverId = direction === 'b2a' ? a : bb;
    setBusy(true);
    try {
      await createSettlement({ senderId, receiverId, amountCents: cents, note: note || undefined });
      setAmount('');
      setNote('');
      setShow(false);
      await onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!show) {
    return (
      <section className="card">
        <button className="btn btn--ghost btn--block" onClick={() => setShow(true)}>💸 Record a settlement</button>
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="card__title">Record a settlement</h3>
      <label className="field">
        <span className="field__label">Direction</span>
        <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as 'b2a' | 'a2b')}>
          <option value="b2a">{nameB} → {nameA}</option>
          <option value="a2b">{nameA} → {nameB}</option>
        </select>
      </label>
      <label className="field">
        <span className="field__label">Amount</span>
        <input
          className="input"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 20 or 20,50"
        />
      </label>
      <label className="field">
        <span className="field__label">Note (optional)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid back for groceries" />
      </label>
      <div className="alloc-row">
        <button className="btn btn--ghost" onClick={() => setShow(false)}>Cancel</button>
        <button className="btn btn--primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save settlement'}</button>
      </div>
    </section>
  );
}
