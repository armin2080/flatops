import type { Adjustment } from '../lib/types';
import AllocationPicker from './AllocationPicker';

interface Props {
  adjustment: Adjustment;
  nameA: string;
  nameB: string;
  onChange: (a: Adjustment) => void;
  onDelete: () => void;
}

const KIND_LABELS: Record<string, string> = {
  discount: 'Discount',
  pfand: 'Pfand',
  refund: 'Refund',
  other: 'Other',
};

export default function AdjustmentCard({ adjustment, nameA, nameB, onChange, onDelete }: Props) {
  const patch = (p: Partial<Adjustment>) => onChange({ ...adjustment, ...p });

  return (
    <div className="card card--adjustment">
      <div className="card__head">
        <span className="badge badge--adjustment">{KIND_LABELS[adjustment.kind] || 'Adjustment'}</span>
        <button type="button" className="icon-btn" onClick={onDelete} aria-label="Delete adjustment">✕</button>
      </div>
      <div className="grid grid--2">
        <label className="field">
          <span className="field__label">Label</span>
          <input
            className="input"
            value={adjustment.label}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="Pfand"
          />
        </label>
        <label className="field">
          <span className="field__label">Amount (negative = discount)</span>
          <input
            className="input"
            inputMode="decimal"
            value={(adjustment.amountCents / 100).toFixed(2)}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) patch({ amountCents: Math.round(n * 100) });
            }}
          />
        </label>
      </div>
      <AllocationPicker
        type={adjustment.allocationType}
        aCents={adjustment.allocationACents}
        totalCents={adjustment.amountCents}
        nameA={nameA}
        nameB={nameB}
        onChange={(type, aCents) => patch({ allocationType: type, allocationACents: aCents })}
      />
    </div>
  );
}
