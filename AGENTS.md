# AGENTS.md — FlatOps development conventions

Orientation for AI coding assistants working on this repository.

## What this project is

FlatOps is a Telegram Serverless bot + Mini App for shared household finance
(receipts → allocation → running balance). Phase 1 is implemented. The project
must stay modular so later phases (shopping lists, chores, …) can be added
without rewriting the receipt/ledger foundation.

## Platform constraints (non-negotiable)

Telegram Serverless is **not** a normal Node.js server. See `docs/tgcloud-sdk.md`
and https://blogfork.telegram.org/bots/serverless.

- Only `tgcloud/` is deployed: `handlers/` (flat), `endpoints/` (flat),
  `lib/` (subdirectories allowed), and `schema.js` (single file).
- Only the `sdk` package and **relative imports ending in `.js`** resolve at
  runtime. **No npm packages, no `process.env`, no filesystem, no `Buffer`.**
- `sdk` surface: `db` (Drizzle-like builder + schema DSL via `sdk/db`),
  `api` (Bot API), `fetch` (outbound HTTP), `InputFile`, `BotApiError`,
  `EndpointError`.
- **No foreign keys** — `PRAGMA foreign_keys` is off. Model relationships with
  plain id columns and enforce integrity in application code.
- **Every `db` call is async** — always `await` the terminal method
  (`.all()`, `.get()`, `.run()`, `.values()`).
- Use `Uint8Array` for bytes, not `Buffer`.
- Handlers receive the unwrapped update payload + a `ctx` (second arg).
- Endpoints receive `(input, ctx)`; identity is `ctx.initData.user.id`, already
  **verified by the platform**. Never trust a user id from the frontend.

## Code organisation

- `tgcloud/lib/` — shared code. **Pure business logic must not import `sdk`** so
  it can be unit-tested locally (see `money.js`, `allocation/`, `ledger/`,
  `receipts/reconcile.js`, `receipts/validate.js`, `receipts/parse.js`,
  `receipts/fingerprint.js`).
- `tgcloud/lib/store/` — DB access (imports `sdk`); wires pure logic to SQLite.
- `tgcloud/lib/security/` — identity/authorization and settings/secrets.
- `tgcloud/lib/integrations/` — AI provider adapters. Add a new provider in
  `providers/` and register it in `ocr.js`'s `PROVIDERS` map; never change
  receipt processing to change a provider.
- `tgcloud/handlers/` and `tgcloud/endpoints/` — thin; call into `lib/`.

## Financial rules

- All money is **integer cents**. Never floating point for totals.
- See `docs/financial-model.md` for the sign convention and invariants. Do not
  change allocation rounding or the balance formula without updating that doc
  and the tests in `tests/unit/ledger.test.js` / `allocation.test.js`.
- The balance is **always recomputed on read** from confirmed receipts +
  settlements (never stored incrementally). This is what makes editing,
  cancelling, or removing a confirmed receipt safe: saving a draft sets it back
  to `awaiting_review`, and cancelling/removing simply drop it out of the next
  balance computation.
- Spending **categories** are defined in `tgcloud/lib/analytics/categories.js`
  (a single canonical list). The frontend fetches them from the backend rather
  than duplicating them.
- **Chores** (recurring routines) live in `tgcloud/lib/chores/` + `store/chores.js`.
  There is **no cron** on Telegram Serverless — reminders fire lazily, on the next
  bot interaction (any message or Mini App open). Don't assume a scheduler exists.

## Secrets

- AI provider key + setup code live **only** in the `settings` table
  (`tgcloud/lib/security/config.js`). Never put them in source, the frontend,
  or logs. Never return them from an endpoint.

## Schema changes

- Edit `tgcloud/schema.js`, then `npx tgcloud push` and `npx tgcloud migrate`.
  Migrations must be **additive and non-destructive**. Mark drops with
  `.deprecated(...)` rather than deleting.

## Testing & build

- `npm test` (Vitest) tests the pure logic. Keep fixtures synthetic
  (`tests/fixtures/german-receipts.js`) — never commit real receipts.
- `npm run build` type-checks (`tsc --noEmit`) and builds the Mini App (Vite).

## Commands (via local `@tgcloud/cli`)

`npx tgcloud login|status|diff|push|migrate|run|fetch|pull|webhook`.

Do **not** use `push --force` to resolve sync conflicts.
