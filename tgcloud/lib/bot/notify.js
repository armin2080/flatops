// bot/notify.js — send Telegram notifications to the *other* participant when
// a shared event happens (e.g. a receipt is confirmed). FlatOps is a two-person
// household, so "notify" means: tell whoever did NOT do the action.

import { api } from 'sdk';
import { getOrderedParticipants } from '../security/auth.js';
import { formatCents } from '../money.js';

/**
 * Notify the other participant that a receipt was confirmed.
 *
 * @param {number} confirmerTgId the Telegram id of the person who confirmed.
 * @param {object} receipt { store, printedTotalCents, currency, respA, respB }.
 */
export async function notifyReceiptConfirmed(confirmerTgId, receipt) {
  const { a, b } = await getOrderedParticipants();
  const people = [a, b].filter(Boolean);
  const confirmer = people.find((p) => p.tgId === confirmerTgId);
  if (!confirmer) return;

  const name = confirmer.displayName || 'Your roommate';
  const storeText = receipt.store ? ` from ${receipt.store}` : '';

  for (const other of people) {
    if (other.tgId === confirmerTgId) continue;
    const share = other.id === a.id ? receipt.respA : receipt.respB;
    const text = [
      `🧾 ${name} just confirmed a receipt${storeText} for ${formatCents(receipt.printedTotalCents, receipt.currency)}.`,
      `Your share: ${formatCents(share, receipt.currency)}.`,
    ].join('\n');
    try {
      await api.sendMessage({ chat_id: other.tgId, text });
    } catch (err) {
      console.warn('notify receipt confirmed failed', err && err.message ? err.message : err);
    }
  }
}
