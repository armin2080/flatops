# Financial model

All money is stored and computed as **integer cents**. Floating point is never
used for monetary totals.

## Participants

- **Person A** = the participant with the lower internal `participants.id`
  (the first registrant / admin).
- **Person B** = the participant with the higher id.

## Allocations

Each receipt line (item or adjustment) has an `allocation_type`:

| Type | Rule |
|---|---|
| `shared` | A gets `floor(cents / 2)`, B gets the remainder. On odd cents **B gets the extra cent** (deterministic). |
| `person_a` | 100% to A. |
| `person_b` | 100% to B. |
| `custom` | A gets `allocACents` (clamped to `[0, cents]` for positive lines, `[cents, 0]` for negative lines), B gets the remainder. |

Every split satisfies `a + b === cents` exactly — **rounding never creates or
destroys money**. Negative lines (discounts/refunds) split correctly.

## Receipt responsibilities

```
respA = Σ splitA(line)  over all items and adjustments
respB = total - respA
total = Σ line cents
```

## Balance (sign convention)

`netBalanceCents` is the amount **Person B owes Person A**:

```
netBalanceCents = Σ over confirmed receipts:
                    payer == A ? (total - respA) : -respA
                + Σ over settlements:
                    sender == A ? +amount : -amount
```

- `netBalanceCents > 0` → B owes A.
- `netBalanceCents < 0` → A owes B (`aOwesB = -net`).
- `bOwesA = max(net, 0)`, `aOwesB = max(-net, 0)`.

## Reconciliation

The **calculated total** is the sum of all item line totals plus all adjustments
(discounts negative, Pfand/charges positive). The **printed total** is the
receipt grand total. A receipt is `reconciled` when they are equal; a non-zero
`discrepancyCents` blocks confirmation until fixed (correct a line or add an
adjustment).

## Invariants (tested)

1. Every confirmed receipt's allocations sum to its printed total.
2. `netBalanceA + netBalanceB === 0`.
3. Confirming twice is idempotent (a receipt affects the balance once).
4. Unconfirmed / cancelled / failed receipts do not affect the balance.
5. Settlements update the balance without changing historical receipts.
6. Rounding never creates or destroys money.

## Example

- Trip 1: A pays €31.60; A's responsibility €17.60, B's €14.00 → B owes A €14.00.
- Trip 2: B pays €25.00; A's responsibility €10.00, B's €15.00 → A owes B €10.00.
- Combined: B owes A €4.00.
