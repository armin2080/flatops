# Architecture

FlatOps is split into a Telegram Serverless backend (`tgcloud/`) and a
React Mini App frontend (`src/`). Financial business logic is pure and
platform-independent; platform-specific code is a thin shell.

## Backend (`tgcloud/`)

```
tgcloud/
├─ schema.js                      # SQLite schema (single file)
├─ handlers/
│  ├─ message.js                  # text commands, photos, documents
│  └─ callback_query.js           # inline button presses (retry/cancel/settle)
├─ endpoints/                     # Mini App backend (flat)
│  ├─ getReceipt.js               # load a receipt view
│  ├─ saveReceipt.js              # persist a draft
│  ├─ confirmReceipt.js           # idempotent confirm
│  ├─ cancelReceipt.js
│  ├─ getBalance.js
│  ├─ getHistory.js
│  ├─ getParticipants.js
│  ├─ getSettings.js              # admin-only non-secret config
│  ├─ adminBootstrap.js           # one-time setup-code seeding
│  ├─ getShoppingList.js / addShoppingItem.js / updateShoppingItem.js / clearShoppingList.js
│  └─ getAnalytics.js             # monthly spending breakdown
└─ lib/
   ├─ money.js                    # parse/format German money → cents (pure)
   ├─ allocation/
   │  ├─ allocation.js            # splitCents, validate (pure)
   │  └─ preferences.js           # remember allocation decisions (pure)
   ├─ ledger/
   │  └─ ledger.js                # responsibilities + balance (pure)
   ├─ analytics/
   │  ├─ categories.js            # canonical categories + keyword categoriser (pure)
   │  └─ analytics.js             # monthly aggregation (pure)
   ├─ receipts/
   │  ├─ fingerprint.js           # content hashing for dedupe (pure)
   │  ├─ parse.js                 # extract JSON from model text (pure)
   │  ├─ validate.js              # normalise/validate AI output (pure)
   │  ├─ reconcile.js             # printed vs calculated totals (pure)
   │  └─ process.js               # image → structured receipt pipeline
   ├─ integrations/
   │  ├─ base64.js                # bytes → base64 (pure)
   │  ├─ prompt.js                # extraction prompt (pure)
   │  ├─ providers/openai.js      # OpenAI-compatible (strict JSON mode)
   │  ├─ providers/groq.js        # Groq vision (no JSON mode)
   │  └─ ocr.js                   # orchestration + provider registry
   ├─ security/
   │  ├─ auth.js                  # identity from tg id
   │  └─ config.js                # settings table (incl. secrets)
   ├─ store/
   │  ├─ receipts.js              # receipt DB access + confirm/balance
   │  ├─ balance.js               # history + settlement queries
   │  ├─ shopping.js              # shopping list DB access
   │  └─ analytics.js             # analytics assembly
   └─ bot/
      └─ render.js                # shared reply/keyboard rendering
```

### Key principles

- **Identity** is the immutable Telegram numeric user id (`message.from.id` in
  handlers, `ctx.initData.user.id` in endpoints — the latter is verified by the
  platform). Usernames are never used for authorization.
- **Secrets** (AI key, setup code) live only in the `settings` table and are
  never logged or returned to the frontend.
- **No foreign keys** — integrity is enforced in application code (parents
  inserted before children, children deleted before parents on replace).
- **Money is integer cents**; `parseMoneyToCents` handles `2,49 €`, `1.234,56`,
  etc.

## Frontend (`src/`)

```
src/
├─ main.tsx / App.tsx             # entry + view routing (query params)
├─ lib/
│  ├─ telegram.ts                 # Telegram.WebApp + Serverless.call wrapper
│  ├─ api.ts                      # typed endpoint calls
│  ├─ money.ts / allocation.ts    # client-side mirror for live preview
│  └─ types.ts                    # payload types
├─ components/
│  ├─ AllocationPicker.tsx        # Shared / A / B / Custom
│  ├─ ItemCard.tsx                # editable product line
│  └─ AdjustmentCard.tsx          # discount / Pfand / other
└─ pages/
   ├─ ReviewReceipt.tsx           # the allocation screen (live totals)
   ├─ ConfirmReceipt.tsx          # final confirmation
   ├─ BalanceView.tsx             # balance + history
   └─ SetupView.tsx               # first-time setup code
```

The frontend recomputes totals **immediately** as the user edits (a mirror of
the backend math). The backend is the source of truth and re-validates on save
and confirm.

## Data flow

1. `handlers/message.js` receives a photo → `processNewReceipt` downloads bytes,
   fingerprints for dedupe, creates a `processing` receipt, and runs OCR.
2. `lib/receipts/validate.js` normalises the AI result into cents, preserving
   German names, adding English translations, and flagging uncertainty.
3. The bot edits its message to show a **Review receipt** `web_app` button.
4. The Mini App loads the receipt via `getReceipt`, lets the user edit/allocate,
   and calls `saveReceipt` then `confirmReceipt`.
5. `confirmReceipt` re-validates (reconciliation + allocations + duplicate
   check), marks the receipt confirmed, records allocation preferences, and
   returns the new balance computed by `lib/ledger/ledger.js`.

## Extending later

- **New AI provider:** add `lib/integrations/providers/<name>.js` (export an
  `extractReceiptText(fetchImpl, settings, imageBase64, mimeType)` function) and
  register it in `ocr.js`.
- **New commands:** add to `handlers/message.js` and `lib/bot/`.
- **New Mini App screens:** add a page under `src/pages/` and route in `App.tsx`.
- **New data:** extend `schema.js` additively and `migrate`.
