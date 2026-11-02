import { useState } from 'react';
import type { ReceiptView } from '../lib/types';
import { confirmReceipt } from '../lib/api';
import { formatCents } from '../lib/money';

interface Props {
  view: ReceiptView;
  nameA: string;
  nameB: string;
  onBack?: () => void;
  onEdit?: () => void;
  onHome: () => void;
  alreadyConfirmed?: boolean;
}

export default function ConfirmReceipt({ view, nameA, nameB, onBack, onEdit, onHome, alreadyConfirmed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ balance: number; alreadyConfirmed: boolean } | null>(null);

  const payer = view.participants.find((p) => p.id === view.receipt.payerId);
  const payerName = payer?.displayName || 'Unknown';
  const reconciled = view.totals.discrepancyCents === 0;

  const runConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await confirmReceipt(view.receipt.id);
      setDone({ balance: res.balance.netBalanceCents, alreadyConfirmed: res.alreadyConfirmed });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const net = done.balance;
    const summary =
      net === 0
        ? 'You are all settled up 🎉'
        : net > 0
          ? `${nameB} owes ${nameA} ${formatCents(net)}`
          : `${nameA} owes ${nameB} ${formatCents(-net)}`;
    return (
      <div className="center">
        <div className="card card--success">
          <div className="success-icon">✅</div>
          <h2>{done.alreadyConfirmed ? 'Already confirmed' : 'Receipt confirmed'}</h2>
          <p className="muted">{summary}</p>
          <button className="btn btn--primary btn--block" onClick={onHome}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        {onBack ? <button className="link" onClick={onBack}>← Back</button> : <span />}
        <h1 className="page__title">Confirm</h1>
        <span />
      </header>

      {alreadyConfirmed && (
        <div className="banner banner--warn">
          This receipt is confirmed. You can edit it — editing will un-confirm it
          until you confirm again.
        </div>
      )}

      <section className="card">
        <div className="kv"><span>Store</span><strong>{view.receipt.store || '—'}</strong></div>
        <div className="kv"><span>Date</span><strong>{view.receipt.date || '—'}</strong></div>
        <div className="kv"><span>Paid by</span><strong>{payerName}</strong></div>
        <div className="kv"><span>Total</span><strong>{formatCents(view.receipt.printedTotalCents)}</strong></div>
      </section>

      <section className="card">
        <h3 className="card__title">Split</h3>
        <div className="kv"><span>{nameA} responsibility</span><strong>{formatCents(view.totals.respA)}</strong></div>
        <div className="kv"><span>{nameB} responsibility</span><strong>{formatCents(view.totals.respB)}</strong></div>
        <div className="kv"><span>Items</span><strong>{view.items.length}</strong></div>
      </section>

      {!reconciled && (
        <div className="banner banner--warn">
          ⚠️ The line totals ({formatCents(view.totals.calculatedTotalCents)}) don't match the printed total ({formatCents(view.receipt.printedTotalCents)}). Go back and fix it before confirming.
        </div>
      )}

      {view.receipt.warnings.length > 0 && (
        <div className="banner banner--warn">
          {view.receipt.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {error && <div className="banner banner--error">{error}</div>}

      <footer className="footer">
        {alreadyConfirmed ? (
          <button className="btn btn--primary btn--block" onClick={onEdit}>
            ✏️ Edit receipt
          </button>
        ) : (
          <button
            className="btn btn--primary btn--block"
            disabled={busy || !reconciled}
            onClick={runConfirm}
          >
            {busy ? 'Confirming…' : '✅ Confirm receipt'}
          </button>
        )}
      </footer>
    </div>
  );
}
