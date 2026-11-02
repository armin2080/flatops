import type { ReceiptItem, Category } from '../lib/types';
import AllocationPicker from './AllocationPicker';

interface Props {
  item: ReceiptItem;
  index: number;
  nameA: string;
  nameB: string;
  categories: Category[];
  onChange: (item: ReceiptItem) => void;
  onDelete: () => void;
}

export default function ItemCard({ item, index, nameA, nameB, categories, onChange, onDelete }: Props) {
  const patch = (p: Partial<ReceiptItem>) => onChange({ ...item, ...p });

  return (
    <div className={`card ${item.isUncertain ? 'card--uncertain' : ''}`}>
      <div className="card__head">
        <span className="card__index">#{index + 1}</span>
        {item.isUncertain && <span className="badge badge--warn">uncertain</span>}
        <button type="button" className="icon-btn" onClick={onDelete} aria-label="Delete item">✕</button>
      </div>

      <input
        className="input input--name"
        value={item.originalName}
        placeholder="German name"
        onChange={(e) => patch({ originalName: e.target.value })}
      />
      <input
        className="input input--muted"
        value={item.englishName}
        placeholder="English translation"
        onChange={(e) => patch({ englishName: e.target.value })}
      />

      <div className="grid grid--3">
        <label className="field">
          <span className="field__label">Qty</span>
          <input
            className="input"
            inputMode="decimal"
            value={item.quantity == null ? '' : String(item.quantity)}
            onChange={(e) => {
              const v = e.target.value;
              const n = v === '' ? null : parseFloat(v.replace(',', '.'));
              patch({ quantity: n != null && Number.isFinite(n) ? n : null });
            }}
            placeholder="1"
          />
        </label>
        <label className="field">
          <span className="field__label">Unit</span>
          <input
            className="input"
            value={item.unit}
            onChange={(e) => patch({ unit: e.target.value })}
            placeholder="Stück"
          />
        </label>
        <label className="field">
          <span className="field__label">Category</span>
          <select className="input" value={item.category || 'other'} onChange={(e) => patch({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid--2">
        <label className="field">
          <span className="field__label">Unit price</span>
          <input
            className="input"
            inputMode="decimal"
            value={item.unitPriceCents == null ? '' : (item.unitPriceCents / 100).toFixed(2)}
            onChange={(e) => {
              const v = e.target.value;
              const n = v === '' ? null : parseFloat(v);
              patch({ unitPriceCents: n != null && Number.isFinite(n) ? Math.round(n * 100) : null });
            }}
            placeholder="—"
          />
        </label>
        <label className="field">
          <span className="field__label">Line total</span>
          <input
            className="input"
            inputMode="decimal"
            value={(item.lineTotalCents / 100).toFixed(2)}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) patch({ lineTotalCents: Math.round(n * 100) });
            }}
          />
        </label>
      </div>

      <AllocationPicker
        type={item.allocationType}
        aCents={item.allocationACents}
        totalCents={item.lineTotalCents}
        nameA={nameA}
        nameB={nameB}
        onChange={(type, aCents) => patch({ allocationType: type, allocationACents: aCents })}
      />
    </div>
  );
}
