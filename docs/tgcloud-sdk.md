# Telegram Serverless SDK — quick reference

Condensed from https://blogfork.telegram.org/bots/serverless for this project.

## Project layout

```
tgcloud/
├─ handlers/   # one file per Telegram update type (message.js, callback_query.js, …) — FLAT
├─ endpoints/  # functions the Mini App calls (getProfile.js → POST /api/getProfile) — FLAT
├─ lib/        # shared code; SUBDIRECTORIES allowed
└─ schema.js   # database schema — one file, named table exports
```

Only `.js` files inside those locations are deployed. Everything outside
`tgcloud/` is local-only.

## The module system

```js
import { db, api, fetch, InputFile, BotApiError, EndpointError } from 'sdk';
import { table, integer, text, eq, sql, index, desc, asc } from 'sdk/db';
import { users } from '../schema.js';      // relative, MUST end in .js
import { cart } from '../lib/cart.js';
```

Nothing else resolves: no npm, no filesystem, no `process.env`, no `Buffer`.

## Handlers

```js
// handlers/message.js
export default async function (message, ctx) {
  await api.sendMessage({ chat_id: message.chat.id, text: 'hi' });
}
```
`message` is the unwrapped payload; `ctx.update` carries the raw update.

## Endpoints

```js
// endpoints/getProfile.js
export default async function (input, ctx) {
  const user = ctx.initData.user;          // verified by the platform
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  return { id: user.id };
}
```
Called from the Mini App via `Telegram.WebApp.Serverless.call('getProfile', input, cb)`.
Errors: `err.message`, `err.type` ('ENDPOINT_ERROR' | 'UNAUTHORIZED' | …), `err.parameters`.

## Database (Drizzle-like)

```js
// schema.js
export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('tg_id').notNull().unique(),
  prefs: json('prefs'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({ idx: index('idx_users_tg').on(t.tgId) }));
```

Column types: `text()`, `integer()`, `real()`, `blob()`, `boolean()`, `json()`,
`numeric()`. Modes: `{ mode: 'boolean' | 'json' | 'timestamp' | 'timestamp_ms' | 'bytes' }`.

**No foreign keys** — `.references()` throws. Enforce integrity in app code.

```js
await db.select().from(users).where(eq(users.id, 1)).get();     // row | null
await db.select().from(users).all();                            // rows
await db.insert(users).values({ tgId: 1 }).returning().run();   // returns rows
await db.insert(users).values({ tgId: 1 }).onConflictDoUpdate({ target: users.tgId, set: { name: 'x' } }).run();
await db.update(users).set({ name: 'x' }).where(eq(users.id, 1)).run();
await db.delete(users).where(eq(users.id, 1)).run();
await db.$count(users, eq(users.done, false));
```

Operators: `eq ne gt gte lt lte like and or not inArray isNull between`, `count sum avg min max`, `asc desc`. Raw SQL: `db.run/get/all/values` + `sql` tag.

Every `db` call is async — always `await`.

## Bot API / files / HTTP

```js
const me = await api.getMe();                     // result unwrapped
const bytes = await api.getFileContent(file_id);  // Uint8Array (≤ 20 MB)
await api.sendMessage({ chat_id, text, reply_markup });

const res = await fetch('https://api.example.com', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ a: 1 }),                 // or fetch.body.json/form/text
});
const data = await res.json();                    // response capped at 30 MB
```

## CLI

`login` (BotFather → Serverless → CLI Access token), `status`, `diff`, `push`
(atomic; never touches DB), `migrate` (review + apply schema), `run <module>`
(execute local code on the platform), `fetch`, `pull`, `webhook sync`.

Deploy = `push` then `migrate`. Never `push --force` to dodge conflicts.
