import { useEffect, useMemo, useState } from 'react';
import type { ReceiptView, ReceiptItem, Adjustment } from '../lib/types';
import { getReceipt, saveReceipt, cancelReceipt } from '../lib/api';
import { formatCents } from '../lib/money';
import { splitCents } from '../lib/allocation';
import ItemCard from '../components/ItemCard';
import AdjustmentCard from '../components/AdjustmentCard';
import ConfirmReceipt from './ConfirmReceipt';

interface Props {
  receiptId: number;
  onHome: () => void;
}

interface Totals {
  itemsTotal: number;
  adjustmentsTotal: number;
  calculated: number;
  discrepancy: number;
  respA: number;
  respB: number;
  reconciled: boolean;
}

function computeTotals(items: ReceiptItem[], adjustments: Adjustment[], printedTotal: number): Totals {
  let itemsTotal = 0;
  let adjustmentsTotal = 0;
  let respA = 0;
  let respB = 0;
  for (const it of items) {
    itemsTotal += Math.round(it.lineTotalCents || 0);
    const s = splitCents(it.lineTotalCents, it.allocationType, it.allocationACents);
    respA += s.a;
    respB += s.b;
  }
  for (const a of adjustments) {
    adjustmentsTotal += Math.round(a.amountCents || 0);
    const s = splitCents(a.amountCents, a.allocationType, a.allocationACents);
    respA += s.a;
    respB += s.b;
  }
  const calculated = itemsTotal + adjustmentsTotal;
  return {
    itemsTotal,
    adjustmentsTotal,
    calculated,
    discrepancy: Math.round(printedTotal || 0) - calculated,
    respA,
    respB,
    reconciled: Math.round(printedTotal || 0) === calculated,
  };
}

export default function ReviewReceipt({ receiptId, onHome }: Props) {
  const [view, setView] = useState<ReceiptView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'review' | 'confirm'>('review');

  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [payerId, setPayerId] = useState<number | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await getReceipt(receiptId);
        if (!alive) return;
        setView(v);
        setStore(v.receipt.store || '');
        setDate(v.receipt.date || '');
        setPayerId(v.receipt.payerId ?? (v.participants[0]?.id ?? null));
        setItems(v.items);
        setAdjustments(v.adjustments);
        setStep(v.receipt.status === 'confirmed' ? 'confirm' : 'review');
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [receiptId]);

  const nameA = view?.participants[0]?.displayName || 'Person A';
  const nameB = view?.participants[1]?.displayName || 'Person B';

  const printedTotal = view?.receipt.printedTotalCents ?? 0;
  const totals = useMemo(() => computeTotals(items, adjustments, printedTotal), [items, adjustments, printedTotal]);

  if (loading) return <div className="center"><p className="muted">Loading receipt…</p></div>;
  if (error) return <div className="center"><p className="error">{error}</p><button className="btn" onClick={onHome}>Home</button></div>;
  if (!view) return null;

  const isConfirmed = view.receipt.status === 'confirmed';

  const updateItem = (i: number, item: ReceiptItem) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? item : it)));
  };
  const deleteItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        position: prev.length,
        originalName: '',
        englishName: '',
        quantity: null,
        unit: '',
        unitPriceCents: null,
        lineTotalCents: 0,
        category: 'other',
        confidence: null,
        isUncertain: false,
        allocationType: 'shared',
        allocationACents: null,
        suggestedType: 'shared',
        suggestedACents: null,
        splitA: 0,
        splitB: 0,
      },
    ]);

  const updateAdj = (i: number, a: Adjustment) => setAdjustments((prev) => prev.map((x, idx) => (idx === i ? a : x)));
  const deleteAdj = (i: number) => setAdjustments((prev) => prev.filter((_, idx) => idx !== i));
  const addAdj = () =>
    setAdjustments((prev) => [
      ...prev,
      {
        position: prev.length,
        kind: 'other',
        label: '',
        amountCents: 0,
        allocationType: 'shared',
        allocationACents: null,
        suggestedType: 'shared',
        suggestedACents: null,
        splitA: 0,
        splitB: 0,
      },
    ]);

  const continueToConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveReceipt({
        receiptId,
        store,
        date,
        currency: view.receipt.currency,
        payerId,
        printedTotalCents: printedTotal,
        items,
        adjustments,
      });
      setView(saved);
      setItems(saved.items);
      setAdjustments(saved.adjustments);
      setStep('confirm');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this receipt? It will not affect the balance.')) return;
    try {
      await cancelReceipt(receiptId);
      onHome();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (step === 'confirm') {
    return (
      <ConfirmReceipt
        view={view}
        nameA={nameA}
        alreadyConfirmed={isConfirmed}
        onEdit={() => setStep('review')}
        nameB={nameB}
        onBack={() => setStep('review')}
        onHome={onHome}
      />
    );
  }

  const warnings = [...(view.receipt.warnings || [])];
  if (!totals.reconciled) {
    warnings.push(`Totals don't reconcile: printed ${formatCents(printedTotal)} vs calculated ${formatCents(totals.calculated)} (difference ${formatCents(totals.discrepancy)}). Add an adjustment or fix a line.`);
  }

  return (
    <div className="page">
      <header className="page__header">
        <button className="link" onClick={onHome}>← Back</button>
        <h1 className="page__title">Review receipt</h1>
        <button className="link link--danger" onClick={handleCancel}>Cancel</button>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <section className="card card--meta">
        <label className="field">
          <span className="field__label">Store</span>
          <input className="input" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store" />
        </label>
        <div className="grid grid--2">
          <label className="field">
            <span className="field__label">Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Payer</span>
            <select className="input" value={payerId ?? ''} onChange={(e) => setPayerId(e.target.value ? Number(e.target.value) : null)}>
              {view.participants.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName || `User ${p.id}`}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="meta__total">
          <span>Printed total</span>
          <strong>{formatCents(printedTotal)}</strong>
        </div>
      </section>

      {warnings.length > 0 && (
        <div className="banner banner--warn">
          {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      <section>
        <div className="section-head">
          <h2>Items ({items.length})</h2>
          <button className="btn btn--ghost" onClick={addItem}>+ Add item</button>
        </div>
        {items.map((it, i) => (
          <ItemCard
            key={`${it.id ?? 'new'}-${i}`}
            item={it}
            index={i}
            categories={view.categories || []}
            nameA={nameA}
            nameB={nameB}
            onChange={(updated) => updateItem(i, updated)}
            onDelete={() => deleteItem(i)}
          />
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>Adjustments</h2>
          <button className="btn btn--ghost" onClick={addAdj}>+ Add</button>
        </div>
        {adjustments.map((a, i) => (
          <AdjustmentCard
            key={`${a.id ?? 'new'}-${i}`}
            adjustment={a}
            nameA={nameA}
            nameB={nameB}
            onChange={(updated) => updateAdj(i, updated)}
            onDelete={() => deleteAdj(i)}
          />
        ))}
      </section>

      <footer className="footer">
        <div className="footer__rows">
          <div className="footer__row">
            <span>{nameA} responsibility</span>
            <strong>{formatCents(totals.respA)}</strong>
          </div>
          <div className="footer__row">
            <span>{nameB} responsibility</span>
            <strong>{formatCents(totals.respB)}</strong>
          </div>
          <div className="footer__row">
            <span>Calculated total</span>
            <strong className={totals.reconciled ? '' : 'text-warn'}>{formatCents(totals.calculated)}</strong>
          </div>
          <div className="footer__row">
            <span>Printed total</span>
            <strong>{formatCents(printedTotal)}</strong>
          </div>
        </div>
        <button
          className="btn btn--primary btn--block"
          disabled={saving || items.length === 0}
          onClick={continueToConfirm}
        >
          {saving ? 'Saving…' : 'Continue to confirmation →'}
        </button>
      </footer>
    </div>
  );
}
