// handlers/callback_query.js — inline button presses.
//
// Handles: retry:<receiptId>, cancel:<receiptId>, and the settlement direction
// selection (settle:<senderId>:<receiverId> | settle:cancel).

import { api, db } from 'sdk';
import { eq } from 'sdk/db';

import { pendingActions } from '../schema.js';
import { processReceiptImage } from '../lib/receipts/process.js';
import { cancelReceipt } from '../lib/store/receipts.js';
import { getParticipantByTgId } from '../lib/security/auth.js';
import { participantNameMap } from '../lib/store/balance.js';
import { completeChore, listChores } from '../lib/store/chores.js';
import { deliverResult } from '../lib/bot/render.js';

const now = () => Math.floor(Date.now() / 1000);

export default async function (callbackQuery) {
  const data = callbackQuery.data || '';
  const from = callbackQuery.from;
  const msg = callbackQuery.message;
  const chatId = msg && msg.chat ? msg.chat.id : null;
  const messageId = msg ? msg.message_id : null;

  await api.answerCallbackQuery({ callback_query_id: callbackQuery.id }).catch(() => {});
  if (!from || !chatId) return;

  try {
    if (data.startsWith('retry:')) {
      await handleRetry(chatId, messageId, Number(data.slice(6)), from.id);
    } else if (data.startsWith('cancel:')) {
      await handleCancelReceipt(chatId, messageId, Number(data.slice(7)), from.id);
    } else if (data.startsWith('settle:')) {
      await handleSettleDirection(chatId, data, from.id);
    } else if (data.startsWith('chore_done:')) {
      await handleChoreDone(chatId, messageId, Number(data.slice(11)), from.id);
    }
  } catch (err) {
    console.error('callback handler error', err);
    await api.sendMessage({ chat_id: chatId, text: '⚠️ Something went wrong. Please try again.' }).catch(() => {});
  }
}

async function edit(chatId, messageId, text, replyMarkup) {
  if (messageId != null) {
    await api.editMessageText({ chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup }).catch(() =>
      api.sendMessage({ chat_id: chatId, text, reply_markup: replyMarkup }));
  } else {
    await api.sendMessage({ chat_id: chatId, text, reply_markup: replyMarkup });
  }
}

async function handleRetry(chatId, messageId, receiptId, tgId) {
  const p = await getParticipantByTgId(tgId);
  if (!p) return;
  await edit(chatId, messageId, '🔄 Retrying…', undefined);
  const result = await processReceiptImage(receiptId);
  await deliverResult(chatId, messageId, result);
}

async function handleCancelReceipt(chatId, messageId, receiptId, tgId) {
  const p = await getParticipantByTgId(tgId);
  if (!p) return;
  const res = await cancelReceipt(receiptId);
  await edit(chatId, messageId, `❌ Receipt cancelled.`, undefined);
  return res;
}

async function handleSettleDirection(chatId, data, tgId) {
  const p = await getParticipantByTgId(tgId);
  if (!p) return;

  if (data === 'settle:cancel') {
    await db.delete(pendingActions).where(eq(pendingActions.tgId, tgId)).run();
    await api.sendMessage({ chat_id: chatId, text: 'Settlement cancelled.' });
    return;
  }

  const parts = data.split(':');
  const senderId = Number(parts[1]);
  const receiverId = Number(parts[2]);
  if (!Number.isFinite(senderId) || !Number.isFinite(receiverId)) return;

  // Persist the pending amount step.
  await db.delete(pendingActions).where(eq(pendingActions.tgId, tgId)).run();
  await db.insert(pendingActions).values({
    tgId, action: 'settle_amount', payload: { senderId, receiverId }, createdAt: now(),
  }).run();

  const names = await participantNameMap();
  const sender = names[senderId] || '?';
  const receiver = names[receiverId] || '?';
  await api.sendMessage({
    chat_id: chatId,
    text: `How much did ${sender} pay ${receiver}?\n\nReply with the amount (e.g. 20 or 20,50), or /cancel.`,
  });
}

async function handleChoreDone(chatId, messageId, choreId, tgId) {
  const p = await getParticipantByTgId(tgId);
  if (!p) return;
  await completeChore(choreId, p.id);
  const { items } = await listChores();
  const chore = items.find((c) => c.id === choreId);
  const name = chore?.name || 'Chore';
  const next = chore?.assigneeName || 'someone';
  await edit(chatId, messageId, `✅ ${name} marked done. Next time it's ${next}'s turn.`, undefined);
}
