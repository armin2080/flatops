# Setup & deployment

This walks you from a fresh clone to a live bot with two registered
participants and a working AI provider.

## Prerequisites

- Node.js 18+ (verified with v24).
- A Telegram bot registered with [@BotFather](https://t.me/BotFather).
- **Serverless switched on** for that bot: BotFather → your bot → **Serverless**.
- A CLI access token: BotFather → your bot → **Serverless** → **CLI Access** →
  *Access token* (this is *different* from the bot API token).
- An **AI provider key** (OpenAI, Azure OpenAI, OpenRouter, or a self-hosted
  OpenAI-compatible endpoint).

## 1. Install & link

```bash
npm install
npx tgcloud login            # paste the CLI access token (form app<id>:<secret>)
```

The token is stored in `.tgcloud/` (git-ignored) and never printed.

## 2. Build & deploy

```bash
npm run build               # type-check + build the Mini App into dist/
npx tgcloud push            # deploy backend modules + the Mini App build
npx tgcloud migrate         # create tables (review the safe changes, confirm)
npx tgcloud webhook sync    # point the webhook at the platform
```

`push` prints the Mini App URL — it looks like `https://app<app_id>.tgcloud.ai/`.
Note it down.

## 3. First-time setup (the setup code)

The platform has **no server-side secrets store** (no `process.env`, no
filesystem). So the setup code and the AI key are stored in the bot's private
`settings` table, set only by the admin.

The very first write is the "First-time setup" screen in the Mini App:

1. In BotFather, set the bot's **Menu Button** (or **Main Mini App**) URL to the
   Mini App URL from step 2.
2. Open your bot in Telegram and tap the menu button to launch the Mini App.
3. Open **First-time setup** and choose a **setup code** (≥ 6 characters).
   Anyone who knows this code can register — so a stranger who finds the bot
   cannot claim it.

> Security note: the bootstrap screen is available until the code is first set.
> Because the Mini App URL is only shown to you (via `push`/BotFather), and the
> bot is private, the window is small. If you prefer, you may instead seed the
> code by running the endpoint directly with your CLI token:
> `npx tgcloud run endpoints/adminBootstrap '{ setupCode: "your-code" }' --ctx '{ initData: { user: { id: 0 } } }'`.

## 4. Register the two participants

1. Each person: send `/whoami` to the bot and note their numeric user id.
2. You (the admin): send `/register <setup-code>`.
3. Your roommate: send `/register <setup-code>`.

The first registrant becomes the admin (Person A); the second becomes Person B.

## 5. Configure the AI provider

As the admin, in the bot chat:

```
# OpenAI / Azure / OpenRouter / self-hosted
/setprovider openai
/setmodel gpt-4o-mini
/setbaseurl <url>            # optional; omit for https://api.openai.com/v1
/setkey sk-...               # the message containing the key is auto-deleted

# Groq (free tier) — vision models
/setprovider groq
/setmodel meta-llama/llama-4-scout-17b-16e-instruct    # or meta-llama/llama-4-maverick-17b-128e-instruct
/setkey gsk_...                           # your Groq API key (no /setbaseurl needed)

/seturl https://app<app_id>.tgcloud.ai/   # the Mini App URL (for Review buttons)
/config                      # verify everything
```

> **Groq note:** Groq's vision models do not support strict JSON mode, so the
> Groq adapter omits `response_format` and relies on the prompt + tolerant
> parser. Groq retires models frequently — if a model name is rejected (e.g.
> `model_decommissioned`), get the current vision model from the
> [Groq console → Models](https://console.groq.com/docs/models) and set it with
> `/setmodel`. As of this writing the vision-capable models are the multimodal
> Llama 4 line (`meta-llama/llama-4-scout-17b-16e-instruct`,
> `meta-llama/llama-4-maverick-17b-128e-instruct`).

## 6. Test the full flow

1. Send a photo of a German supermarket receipt (or send it as an image file).
2. The bot replies "Processing…", then shows a **🔍 Review receipt** button.
3. Tap it to open the Mini App: correct names/prices, allocate each item, change
   the payer if needed, resolve any total mismatch.
4. **Continue → Confirm**.
5. Run `/balance` and `/history` to see the result.
6. Record a settlement with `/settle`.

## Database migrations

Schema changes are additive. After editing `tgcloud/schema.js`:

```bash
npx tgcloud push
npx tgcloud migrate      # --dry-run to preview; never drops without confirmation
```

To remove a column/table, mark it `.deprecated('reason')` — never delete it
outright.

## Tests

```bash
npm test          # 46 unit tests (money, allocation, ledger, reconcile, validate, parse)
npm run build     # type-check + production build
```

## Configuration summary

| Setting | Where | How |
|---|---|---|
| CLI access token | `.tgcloud/` (local) | `npx tgcloud login` |
| AI provider key | `settings` table | `/setkey` (admin) |
| AI provider/model/url | `settings` table | `/setprovider`, `/setmodel`, `/setbaseurl` |
| Mini App URL | `settings` table | `/seturl` (admin) |
| Setup code | `settings` table | Mini App "First-time setup" |
| Participants | `participants` table | `/register <code>` |

## Troubleshooting

- **"Review receipt" button missing / warns about Mini App URL**: run `/seturl`.
- **AI provider error on upload**: check `/config` — is a key set? Is the model
  vision-capable? Does your provider support `response_format: json_object`?
  (If not, add a provider adapter in `lib/integrations/providers/`.)
- **Totals don't reconcile**: fix a line or add an adjustment in the Mini App;
  the app will not let you confirm until they match.
- **Duplicate warning**: the same receipt was already uploaded/confirmed.
