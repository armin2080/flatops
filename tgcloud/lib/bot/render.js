// bot/render.js — shared Telegram reply rendering for receipts (the "Review
// receipt" keyboard and the result messages produced after processing).

import { api } from 'sdk';
import { config } from '../security/config.js';
import { formatCents } from '../money.js';

/**
 * Inline keyboard for a processed receipt: a Mini App "Review" button plus
 * Retry and Cancel callbacks.
 */
export async function reviewKeyboard(receiptId) {
  const url = await config.getMiniAppUrl();
  const keyboard = [];
  if (url) {
    const base = url.replace(/\/+$/, '');
    keyboard.push([{ text: '🔍 Review receipt', web_app: { url: `${base}?receiptId=${receiptId}` } }]);
  }
  keyboard.push([
    { text: '🔄 Retry', callback_data: `retry:${receiptId}` },
    { text: '❌ Cancel', callback_data: `cancel:${receiptId}` },
  ]);
  return { inline_keyboard: keyboard };
}

/**
 * Edit (or fall back to sending) the status message for a processing result.
 */
export async function deliverResult(chatId, messageId, result) {
  const edit = (text, reply_markup) =>
    api.editMessageText({ chat_id: chatId, message_id: messageId, text, reply_markup }).catch(() =>
      api.sendMessage({ chat_id: chatId, text, reply_markup }));

  if (result.kind === 'ok') {
    const url = await config.getMiniAppUrl();
    const text = `✅ Receipt recognised!\n\n🏪 ${result.store || 'Unknown store'}\n🧾 ${result.itemCount} item(s)\n💶 Total: ${formatCents(result.printedTotalCents)}` +
      (result.discrepancyCents !== 0 ? `\n⚠️ Totals don't reconcile yet (off by ${formatCents(result.discrepancyCents)}).` : '') +
      (url ? '\n\nTap "Review receipt" to check items and split them.' : '\n\n⚠️ The Mini App URL is not set — ask the admin to run /seturl.');
    await edit(text, await reviewKeyboard(result.receiptId));
    return;
  }
  if (result.kind === 'duplicate_confirmed') {
    await edit('⚠️ This looks like a duplicate of a receipt that is already confirmed. No new expense was created.', undefined);
    return;
  }
  if (result.kind === 'duplicate_pending') {
    const kb = await reviewKeyboard(result.duplicateOfId);
    await edit('⚠️ You already uploaded this receipt — it is still awaiting review. Review the existing one instead.', kb);
    return;
  }
  await edit(
    `❌ Could not process this receipt:\n${result.error || 'unknown error'}\n\nTap Retry to try again.`,
    result.receiptId ? await reviewKeyboard(result.receiptId) : undefined,
  );
}
