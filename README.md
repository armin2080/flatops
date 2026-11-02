# FlatOps

**Shared living, simplified.**

FlatOps is a private household management platform for two roommates. It runs
entirely on **Telegram Serverless** — no servers, no hosting, no infrastructure.
The Telegram bot is the primary interface, and a Telegram Mini App provides the
interactive receipt-review experience.

This repository currently implements **Phase 1: Smart Receipt & Expense
Management**.

---

## What Phase 1 does

Two roommates who shop together (and who read German receipts with difficulty)
can:

1. **Snap a photo** of a supermarket receipt and send it to the bot.
2. Have every line **recognised, extracted, translated** (German → English) and
   **auto-categorised** by a vision-capable AI/OCR provider.
3. **Review and correct** the result in a mobile-first Telegram Mini App.
4. **Allocate** each item — shared, Person A, Person B, or a custom split.
5. **Confirm** the receipt, which then flows into a persistent, running
   **financial ledger**.
6. **Record settlements** (off-platform transfers) to settle up.
7. Share a **shopping list** checklist between the two of you.
8. Define **recurring chores** that rotate whose turn it is and send reminders.
9. See **monthly analytics** — what you spend, on what, and each person's share.

The receipt is reconciled against its printed total, duplicate uploads are
detected, and unconfirmed receipts never affect the balance. Confirmed receipts
can still be **edited, cancelled, or removed** (the balance is always recomputed
from confirmed receipts, so correcting a mistake is safe).

---

## The receipt workflow

```
phone photo / image file
        │  (Telegram)
        ▼
handlers/message.js  →  identify sender, dedupe, create pending receipt
        │
        ▼
lib/receipts/process.js  →  download image, run OCR/vision provider
        │
        ▼
lib/receipts/validate.js →  normalise to cents, preserve German, translate,
                             mark uncertainty, separate unit price / line total
        │
        ▼
bot sends "Review receipt" button (web_app) →  Mini App
        │
        ▼
endpoints/*  →  load / edit / allocate / confirm (identity from verified initData)
        │
        ▼
lib/ledger/ledger.js  →  running balance from confirmed receipts + settlements
```

---

## Architecture

| Layer | Location | Responsibility |
|---|---|---|
| Telegram bot | `tgcloud/handlers/` | Commands, photos, documents, callbacks |
| Mini App backend | `tgcloud/endpoints/` | Verified user actions (review, save, confirm, balance) |
| Receipt processing | `tgcloud/lib/receipts/` | OCR pipeline, validation, reconciliation |
| Allocation | `tgcloud/lib/allocation/` | Splits, preferences |
| Ledger | `tgcloud/lib/ledger/` | Balance calculation (integer cents) |
| Integrations | `tgcloud/lib/integrations/` | Swappable AI provider adapters |
| Security | `tgcloud/lib/security/` | Identity, authorization, settings/secrets |
| Database | `tgcloud/schema.js` | SQLite schema (Drizzle-like DSL) |
| Mini App UI | `src/` | React + TypeScript + Vite |

Financial business logic lives in pure modules (`tgcloud/lib/money.js`,
`allocation`, `ledger`, `receipts/reconcile.js`, `receipts/validate.js`) with
**no** `sdk` imports, so they are unit-tested locally. Platform-specific code
(handlers, endpoints, store access) imports `sdk` and is kept thin.

See `docs/architecture.md` for details.

---

## Technology choices

- **Runtime:** Telegram Serverless (V8 isolates, `sdk`, built-in SQLite).
- **Bot API + DB + HTTP:** the platform `sdk` (`api`, `db`, `fetch`).
- **Mini App:** React + TypeScript + Vite, hosted by Serverless, calling
  `endpoints/` via `Telegram.WebApp.Serverless.call`.
- **AI provider:** OpenAI-compatible vision API (works with OpenAI, Azure OpenAI,
  OpenRouter, or self-hosted endpoints) behind a swappable adapter.
- **Money:** integer cents everywhere — no floating point for totals.

---

## Install dependencies

```bash
npm install
```

## Configure the AI provider

The provider key is stored **only** in the bot's database (the `settings` table),
never in source, the frontend, or logs. Set it from the admin account in
Telegram:

```
# OpenAI / Azure / OpenRouter / self-hosted
/setprovider openai          # or openai_compatible
/setmodel gpt-4o-mini        # any vision model your provider supports
/setbaseurl <url>            # optional; default https://api.openai.com/v1
/setkey <your-api-key>       # the key message is deleted after saving

# Groq (free tier) — vision models
/setprovider groq
/setmodel meta-llama/llama-4-scout-17b-16e-instruct    # or meta-llama/llama-4-maverick-17b-128e-instruct
/setkey gsk_...                          # your Groq API key

/config                      # review current configuration
```

For Groq the base URL is already `https://api.groq.com/openai/v1` by default, so
`/setbaseurl` is not needed.

## Configure the two participants

See `docs/setup.md` for the full, ordered setup. In short:

1. Deploy and note the Mini App URL printed by `npx tgcloud push`.
2. Set the Mini App URL in BotFather (Menu Button or Main Mini App).
3. Open the Mini App → **First-time setup** → choose a setup code.
4. In Telegram: `/whoami` to learn your id, then `/register <setup-code>`.
5. Share the code with your roommate, who also runs `/register <code>`.

The setup code prevents a stranger who finds the bot from claiming it.

## Run tests

```bash
npm test          # Vitest unit tests (financial + parsing logic)
npm run build     # type-check + production build of the Mini App
```

## Deploy to Telegram Serverless

```bash
npx tgcloud login       # BotFather → your bot → Serverless → CLI Access → token
npx tgcloud push        # deploy modules + Mini App build
npx tgcloud migrate     # apply schema changes (review + confirm)
npx tgcloud webhook sync
```

`npm run deploy` builds the Mini App and pushes in one step.

## Known limitations & configuration requirements

- You must provide a **tgcloud CLI token** (from BotFather) and an **AI provider
  key** before real receipt processing works. Everything else is implemented.
- The platform has no server-side secrets store; the AI key and setup code live
  in the private `settings` table, configurable only by the admin.
- Only one built-in AI provider (OpenAI-compatible) plus Groq. Add more adapters
  in `tgcloud/lib/integrations/providers/` without touching receipt processing.
- Raw receipt images are not retained — only the `file_id`/`file_unique_id`
  needed for retry, plus structured data and a fingerprint for deduplication.

See `docs/setup.md` for exact deployment and testing instructions, and
`docs/financial-model.md` for the calculation rules.