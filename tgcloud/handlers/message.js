// handlers/message.js — the main Telegram message handler.
//
// Routes text commands, receipt photos, documents, and the amount step of the
// settlement flow. Identity is the sender's immutable Telegram user id.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';

import { participants, pendingActions, settlements } from '../schema.js';
import { parseMoneyToCents, formatCents } from '../lib/money.js';
import { describeBalance } from '../lib/ledger/ledger.js';
import {
  authorizeTgId, getOrderedParticipants, getParticipantByTgId, participantCount,
} from '../lib/security/auth.js';
import { config, loadPublicSettings, loadSettings } from '../lib/security/config.js';
import { processNewReceipt, processReceiptImage } from '../lib/receipts/process.js';
import { currentBalance, removeReceipt } from '../lib/store/receipts.js';
import { recentReceipts, recentSettlements, participantNameMap } from '../lib/store/balance.js';
import { getShoppingList, addShoppingItems } from '../lib/store/shopping.js';
import { listChores, evaluateAndRemind } from '../lib/store/chores.js';
import { deliverResult } from '../lib/bot/render.js';
import { listModels, isLikelyVision } from '../lib/integrations/models.js';

const now = () => Math.floor(Date.now() / 1000);

const WELCOME = `👋 Welcome to FlatOps — shared living, simplified.

Snap a photo of a supermarket receipt and I'll extract every item, translate it from German, and let you split it with your roommate.

Commands:
/balance — current balance
/history — recent receipts & settlements
/settle — record a payment between you
/list — view the shared shopping list
/add <items> — add item(s) to the shopping list (comma-separated)
/chores — view recurring chores and mark them done
/remove <id> — permanently remove a receipt
/cancel — cancel the current operation
/whoami — your Telegram user id
/help — this message`;

export default async function (message) {
  const chatId = message.chat && message.chat.id;
  const from = message.from;
  if (!chatId || !from) return;
  const tgId = from.id;

  try {
    // Any interaction is a chance to fire due chore reminders (no cron here).
    await evaluateAndRemind().catch(() => {});

    if (message.text) {
      if (message.text.startsWith('/')) {
        await handleCommand(message, chatId, from, tgId);
      } else {
        await handleFreeText(message, chatId, tgId);
      }
    } else if (Array.isArray(message.photo) && message.photo.length) {
      await handlePhoto(message, chatId, tgId);
    } else if (message.document) {
      await handleDocument(message, chatId, tgId);
    } else {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a photo of a receipt, or use /help.' });
    }
  } catch (err) {
    console.error('message handler error', err);
    try {
      await api.sendMessage({ chat_id: chatId, text: '⚠️ Something went wrong. Please try again.' });
    } catch { /* ignore */ }
  }
}

async function requireParticipant(tgId, chatId) {
  const p = await authorizeTgId(tgId);
  if (!p) {
    await api.sendMessage({
      chat_id: chatId,
      text: '⛔ You are not authorised. This is a private household bot for two people only.',
    });
    return null;
  }
  return p;
}

async function handleCommand(message, chatId, from, tgId) {
  const text = message.text.trim();
  const [command, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ').trim();

  switch (command) {
    case '/start':
      return handleStart(chatId, tgId, from);
    case '/help':
      return api.sendMessage({ chat_id: chatId, text: WELCOME });
    case '/whoami':
      return api.sendMessage({ chat_id: chatId, text: `Your Telegram user id is: ${tgId}` });
    case '/register':
      return handleRegister(chatId, tgId, from, arg);
    case '/balance':
      return handleBalance(chatId, tgId);
    case '/history':
      return handleHistory(chatId, tgId);
    case '/settle':
      return handleSettleStart(chatId, tgId);
    case '/list':
      return handleList(chatId, tgId);
    case '/add':
      return handleAdd(chatId, tgId, arg);
    case '/chores':
      return handleChores(chatId, tgId);
    case '/remove':
      return handleRemove(chatId, tgId, arg);
    case '/cancel':
      return handleCancel(chatId, tgId);
    case '/config':
      return handleConfig(chatId, tgId);
    case '/setkey':
      return handleSetKey(chatId, tgId, arg, message.message_id);
    case '/setmodel':
      return handleSetModel(chatId, tgId, arg);
    case '/setprovider':
      return handleSetProvider(chatId, tgId, arg);
    case '/setbaseurl':
      return handleSetBaseUrl(chatId, tgId, arg);
    case '/seturl':
      return handleSetUrl(chatId, tgId, arg);
    case '/models':
      return handleModels(chatId, tgId);
    default:
      return api.sendMessage({ chat_id: chatId, text: `Unknown command. Use /help to see what I can do.` });
  }
}

async function handleStart(chatId, tgId, from) {
  const p = await getParticipantByTgId(tgId);
  if (p) {
    await api.sendMessage({ chat_id: chatId, text: `Welcome back, ${p.displayName || 'friend'}! 👋\n\n${WELCOME}` });
    return;
  }
  const setupCode = await config.getSetupCode();
  if (!setupCode) {
    await api.sendMessage({
      chat_id: chatId,
      text: 'FlatOps is not set up yet. The owner must complete first-time setup (see the project README), then share the setup code.\n\nTo prepare, note your id with /whoami.',
    });
    return;
  }
  await api.sendMessage({
    chat_id: chatId,
    text: 'Welcome to FlatOps! Ask your roommate for the setup code, then send:\n\n/register <code>\n\nYour id: /whoami',
  });
}

async function handleRegister(chatId, tgId, from, arg) {
  if (!arg) {
    await api.sendMessage({ chat_id: chatId, text: 'Usage: /register <setup code>' });
    return;
  }
  const setupCode = await config.getSetupCode();
  if (!setupCode) {
    await api.sendMessage({ chat_id: chatId, text: 'Setup is not complete yet — ask the owner to finish first-time setup.' });
    return;
  }
  if (arg !== setupCode) {
    await api.sendMessage({ chat_id: chatId, text: '❌ Invalid setup code.' });
    return;
  }
  const existing = await getParticipantByTgId(tgId);
  if (existing) {
    await api.sendMessage({ chat_id: chatId, text: 'You are already registered. ✅' });
    return;
  }
  const count = await participantCount();
  if (count >= 2) {
    await api.sendMessage({ chat_id: chatId, text: 'Both participants are already registered.' });
    return;
  }
  const role = count === 0 ? 'admin' : 'member';
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ');
  await db.insert(participants).values({ tgId, displayName, role, isActive: true, createdAt: now() }).run();
  await api.sendMessage({
    chat_id: chatId,
    text: `✅ You're registered as ${role === 'admin' ? 'admin (Person A)' : 'member (Person B)'}.\n\nSend me a receipt photo to get started!`,
  });
}

async function handleBalance(chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const { a, b } = await getOrderedParticipants();
  const balance = await currentBalance(a ? a.id : null);
  const nameA = (a && a.displayName) || 'Person A';
  const nameB = (b && b.displayName) || 'Person B';

  const lines = [
    '📊 FlatOps balance',
    '',
    describeBalance(balance, nameA, nameB),
    '',
    `${nameA} has paid ${formatCents(balance.spentACents)} in total`,
    `${nameB} has paid ${formatCents(balance.spentBCents)} in total`,
    `Shared expenses: ${formatCents(balance.sharedTotalCents)}`,
    '',
    `Net: ${formatCents(balance.netBalanceCents)} (${balance.netBalanceCents >= 0 ? `${nameB} owes ${nameA}` : `${nameA} owes ${nameB}`})`,
  ].join('\n');

  await api.sendMessage({ chat_id: chatId, text: lines });
}

async function handleHistory(chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const names = await participantNameMap();
  const receipts = await recentReceipts(8);
  const settles = await recentSettlements(6);

  const parts = [];
  if (receipts.length) {
    parts.push('🧾 Recent receipts');
    for (const r of receipts) {
      const statusIcon = { confirmed: '✅', awaiting_review: '👀', processing: '⏳', cancelled: '❌', failed: '⚠️' }[r.status] || '•';
      parts.push(`${statusIcon} #${r.id} ${r.store || 'Receipt'} — ${formatCents(r.printedTotalCents)} (${r.purchaseDate || 'no date'})`);
    }
  } else {
    parts.push('🧾 Receipts — none yet.');
  }

  if (settles.length) {
    parts.push('');
    parts.push('💸 Recent settlements');
    for (const s of settles) {
      parts.push(`${names[s.senderId] || '?'} → ${names[s.receiverId] || '?'}: ${formatCents(s.amountCents)}${s.note ? ` (${s.note})` : ''}`);
    }
  }

  await api.sendMessage({ chat_id: chatId, text: parts.join('\n') });
}

async function handleSettleStart(chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const { a, b } = await getOrderedParticipants();
  if (!a || !b) {
    await api.sendMessage({ chat_id: chatId, text: 'Both participants must be registered before recording a settlement.' });
    return;
  }
  const nameA = a.displayName || 'Person A';
  const nameB = b.displayName || 'Person B';
  await api.sendMessage({
    chat_id: chatId,
    text: '💸 Record a payment made *outside* FlatOps.\n\nWho paid whom?',
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: `💶 ${nameB} → ${nameA}`, callback_data: `settle:${b.id}:${a.id}` }],
        [{ text: `💶 ${nameA} → ${nameB}`, callback_data: `settle:${a.id}:${b.id}` }],
        [{ text: 'Cancel', callback_data: 'settle:cancel' }],
      ],
    },
  });
}

async function handleCancel(chatId, tgId) {
  await db.delete(pendingActions).where(eq(pendingActions.tgId, tgId)).run();
  await api.sendMessage({ chat_id: chatId, text: 'Cancelled. ✅' });
}

async function handleRemove(chatId, tgId, arg) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const id = Number(arg);
  if (!Number.isFinite(id) || id <= 0) {
    await api.sendMessage({ chat_id: chatId, text: 'Usage: /remove <receipt-id>\n\nFind ids with /history.' });
    return;
  }
  try {
    await removeReceipt(id);
    await api.sendMessage({ chat_id: chatId, text: `🗑 Receipt #${id} removed.` });
  } catch (e) {
    const msg = e && e.message ? e.message : 'unknown error';
    await api.sendMessage({ chat_id: chatId, text: `Could not remove receipt #${id}: ${msg}` });
  }
}

async function handleList(chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const list = await getShoppingList();
  if (list.items.length === 0) {
    await api.sendMessage({ chat_id: chatId, text: '🛒 Your shopping list is empty.\n\nAdd items with /add milk, eggs, bread — or open the Mini App for an interactive checklist.' });
    return;
  }
  const lines = list.items.map((it) => (it.checked ? '✅' : '⬜') + ' ' + it.text);
  const summary = `🛒 Shopping list (${list.remaining} to get, ${list.done} done)`;
  await api.sendMessage({ chat_id: chatId, text: [summary, '', ...lines].join('\n') });
}

async function handleAdd(chatId, tgId, arg) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  if (!arg) {
    await api.sendMessage({ chat_id: chatId, text: 'Usage: /add <item> — or several, comma-separated: /add milk, eggs, bread' });
    return;
  }
  const texts = arg.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  try {
    const list = await addShoppingItems(texts, p.id);
    const added = texts.join(', ');
    await api.sendMessage({ chat_id: chatId, text: `✅ Added: ${added}\n\n${list.remaining} item(s) to get. Check them off in the Mini App.` });
  } catch (e) {
    await api.sendMessage({ chat_id: chatId, text: `Could not add items: ${e && e.message ? e.message : e}` });
  }
}

async function handleChores(chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const { items } = await listChores();
  if (items.length === 0) {
    await api.sendMessage({ chat_id: chatId, text: '🧹 No chores yet.\n\nAdd some in the Mini App (🧹 Chores), then I\'ll remind whoever\'s turn it is.' });
    return;
  }

  const icon = { overdue: '🔴', due: '🟠', upcoming: '📅', none: '✅' };
  const lines = items.map((c) => {
    const status = icon[c.status] || '•';
    const dueDate = new Date(c.nextDueAt * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const who = c.assigneeName ? ` — ${c.assigneeName}'s turn` : '';
    return `${status} ${c.name}${c.isActive === false ? ' (paused)' : ''}\n   ${c.frequencyLabel} · next ${dueDate}${who}`;
  });

  const keyboard = items
    .filter((c) => c.status === 'due' || c.status === 'overdue')
    .map((c) => [{ text: `✅ Done: ${c.name}`, callback_data: `chore_done:${c.id}` }]);

  const reply_markup = keyboard.length ? { inline_keyboard: keyboard } : undefined;
  await api.sendMessage({
    chat_id: chatId,
    text: `🧹 *Chores*\n\n${lines.join('\n')}\n\nManage them in the Mini App (🧹 Chores).`,
    parse_mode: 'Markdown',
    reply_markup,
  });
}

async function handleFreeText(message, chatId, tgId) {
  const pending = await db.select().from(pendingActions).where(eq(pendingActions.tgId, tgId)).get();
  if (!pending) {
    await api.sendMessage({ chat_id: chatId, text: 'Send me a receipt photo, or use /help for commands.' });
    return;
  }

  if (pending.action === 'settle_amount') {
    const amount = parseMoneyToCents(message.text);
    if (amount == null || amount <= 0) {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a valid amount, e.g. 20 or 20,50.' });
      return;
    }
    const { senderId, receiverId } = pending.payload || {};
    await db.delete(pendingActions).where(eq(pendingActions.id, pending.id)).run();
    await db.insert(settlements).values({
      senderId, receiverId, amountCents: amount, settledAt: now(), createdAt: now(),
    }).run();

    const { a, b } = await getOrderedParticipants();
    const balance = await currentBalance(a ? a.id : null);
    const names = await participantNameMap();
    const sender = names[senderId] || '?';
    const receiver = names[receiverId] || '?';
    const nameA = (a && a.displayName) || 'Person A';
    const nameB = (b && b.displayName) || 'Person B';
    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Recorded: ${sender} paid ${receiver} ${formatCents(amount)}.\n\n${describeBalance(balance, nameA, nameB)}`,
    });
  }
}

async function handleConfig(chatId, tgId) {
  const p = await authorizeTgId(tgId);
  if (!p || p.role !== 'admin') {
    await api.sendMessage({ chat_id: chatId, text: '⛔ Only the admin can change configuration.' });
    return;
  }
  const s = (await config.getSetupCode()) ? 'set' : 'not set';
  const pub = await loadPublicSettings();
  await api.sendMessage({
    chat_id: chatId,
    text: [
      '⚙️ Configuration',
      '',
      `Setup code: ${s}`,
      `AI provider: ${pub.aiProvider}`,
      `AI model: ${pub.aiModel || '(default)'}`,
      `AI base URL: ${pub.aiBaseUrl || '(default)'}`,
      `AI key: ${pub.hasApiKey ? 'configured ✅' : '❌ missing'}`,
      `Mini App URL: ${pub.miniAppUrl || '❌ not set'}`,
      '',
      'Commands: /setkey <key> · /setmodel <m> · /setprovider <p> · /setbaseurl <url> · /seturl <mini-app-url> · /models',
    ].join('\n'),
  });
}

async function handleSetKey(chatId, tgId, arg, messageId) {
  const p = await authorizeTgId(tgId);
  if (!p || p.role !== 'admin') {
    await api.sendMessage({ chat_id: chatId, text: '⛔ Only the admin can change configuration.' });
    return;
  }
  if (!arg) {
    await api.sendMessage({ chat_id: chatId, text: 'Usage: /setkey <api-key>' });
    return;
  }
  await config.setAiApiKey(arg);
  // Best-effort: delete the message containing the secret from the chat.
  try { await api.deleteMessage({ chat_id: chatId, message_id: messageId }); } catch { /* ignore */ }
  await api.sendMessage({ chat_id: chatId, text: '✅ AI provider key saved (and the key message was deleted).' });
}

async function handleSetModel(chatId, tgId, arg) {
  const p = await requireAdmin(chatId, tgId);
  if (!p) return;
  if (!arg) return api.sendMessage({ chat_id: chatId, text: 'Usage: /setmodel <model-name>' });
  await config.setAiModel(arg);
  return api.sendMessage({ chat_id: chatId, text: `✅ AI model set to ${arg}.` });
}

async function handleSetProvider(chatId, tgId, arg) {
  const p = await requireAdmin(chatId, tgId);
  if (!p) return;
  if (!arg) return api.sendMessage({ chat_id: chatId, text: 'Usage: /setprovider openai | groq' });
  await config.setAiProvider(arg);
  return api.sendMessage({ chat_id: chatId, text: `✅ AI provider set to ${arg}.` });
}

async function handleSetBaseUrl(chatId, tgId, arg) {
  const p = await requireAdmin(chatId, tgId);
  if (!p) return;
  if (!arg) return api.sendMessage({ chat_id: chatId, text: 'Usage: /setbaseurl <https://...>' });
  await config.setAiBaseUrl(arg);
  return api.sendMessage({ chat_id: chatId, text: '✅ AI base URL saved.' });
}

async function handleSetUrl(chatId, tgId, arg) {
  const p = await requireAdmin(chatId, tgId);
  if (!p) return;
  if (!arg) return api.sendMessage({ chat_id: chatId, text: 'Usage: /seturl <https://app<id>.tgcloud.ai/>' });
  await config.setMiniAppUrl(arg);
  return api.sendMessage({ chat_id: chatId, text: '✅ Mini App URL saved.' });
}

async function handleModels(chatId, tgId) {
  const p = await requireAdmin(chatId, tgId);
  if (!p) return;
  let ids;
  try {
    const settings = await loadSettings();
    ids = await listModels(settings);
  } catch (e) {
    await api.sendMessage({ chat_id: chatId, text: `Could not list models: ${e && e.message ? e.message : e}` });
    return;
  }

  const vision = ids.filter(isLikelyVision);
  const others = ids.filter((id) => !isLikelyVision(id));
  const parts = [];
  if (vision.length) {
    parts.push('👁️ Likely vision-capable models (pick one of these):');
    parts.push(...vision.map((id) => `• ${id}`));
  } else {
    parts.push('👁️ No obviously vision-capable model found — check the list below.');
  }
  parts.push('');
  parts.push('All models your key can access:');
  parts.push(...others.slice(0, 30).map((id) => `• ${id}`));
  parts.push('');
  parts.push('Set one with: /setmodel <id>');
  await api.sendMessage({ chat_id: chatId, text: parts.join('\n') });
}

async function requireAdmin(chatId, tgId) {
  const p = await authorizeTgId(tgId);
  if (!p || p.role !== 'admin') {
    await api.sendMessage({ chat_id: chatId, text: '⛔ Only the admin can change configuration.' });
    return null;
  }
  return p;
}

async function handlePhoto(message, chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const photo = message.photo[message.photo.length - 1];
  const ack = await api.sendMessage({ chat_id: chatId, text: '📄 Got your receipt. Processing…' });
  const result = await processNewReceipt({
    tgId, fileId: photo.file_id, fileUniqueId: photo.file_unique_id, mimeType: 'image/jpeg',
  });
  await deliverResult(chatId, ack.message_id, result);
}

async function handleDocument(message, chatId, tgId) {
  const p = await requireParticipant(tgId, chatId);
  if (!p) return;
  const doc = message.document;
  const mime = (doc.mime_type || '').toLowerCase();
  if (!mime.startsWith('image/')) {
    await api.sendMessage({ chat_id: chatId, text: 'Please send the receipt as an image (photo or image file).' });
    return;
  }
  const ack = await api.sendMessage({ chat_id: chatId, text: '📄 Got your receipt. Processing…' });
  const result = await processNewReceipt({
    tgId, fileId: doc.file_id, fileUniqueId: doc.file_unique_id, mimeType: mime,
  });
  await deliverResult(chatId, ack.message_id, result);
}

// `reviewKeyboard` and `deliverResult` live in ../lib/bot/render.js and are
// imported at the top of this file.
