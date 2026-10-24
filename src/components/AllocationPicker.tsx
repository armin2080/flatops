import { ALLOC_SHARED, ALLOC_A, ALLOC_B, ALLOC_CUSTOM } from '../lib/allocation';

interface Props {
  type: string;
  aCents: number | null;
  totalCents: number;
  nameA: string;
  nameB: string;
  onChange: (type: string, aCents: number | null) => void;
}

export default function AllocationPicker({ type, aCents, totalCents, nameA, nameB, onChange }: Props) {
  const options = [
    { value: ALLOC_SHARED, label: 'Shared' },
    { value: ALLOC_A, label: nameA },
    { value: ALLOC_B, label: nameB },
    { value: ALLOC_CUSTOM, label: 'Custom' },
  ];

  return (
    <div className="alloc">
      <div className="alloc-row">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`alloc-btn ${type === o.value ? 'alloc-btn--active' : ''}`}
            onClick={() => onChange(o.value, o.value === ALLOC_CUSTOM ? aCents : null)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {type === ALLOC_CUSTOM && (
        <div className="alloc-custom">
          <span className="alloc-custom__label">{nameA} pays</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className="input input--small"
            value={aCents == null ? '' : (aCents / 100).toFixed(2)}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange(ALLOC_CUSTOM, Number.isFinite(n) ? Math.round(n * 100) : null);
            }}
            placeholder="0.00"
          />
          <span className="alloc-custom__total">of {(totalCents / 100).toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
