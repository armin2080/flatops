// store/chores.js — database access for chores and reminder delivery.

import { api, db, EndpointError } from 'sdk';
import { eq, asc } from 'sdk/db';
import { chores, choreCompletions } from '../../schema.js';
import {
  nextDueAt, currentAssigneeId, evaluateChore, REMINDER_LEVELS, frequencyLabel,
} from '../chores/chores.js';
import { getOrderedParticipants } from '../security/auth.js';

const now = () => Math.floor(Date.now() / 1000);

async function ordered() {
  const { a, b } = await getOrderedParticipants();
  return [a, b].filter(Boolean);
}

/**
 * Build the frontend-ready view of all chores (with status + assignee name).
 */
export async function listChores() {
  const rows = await db.select().from(chores).orderBy(asc(chores.id)).all();
  const people = await ordered();
  const nameOf = (id) => (people.find((p) => p.id === id)?.displayName) || '—';

  const items = rows.map((c) => {
    const assigneeId = currentAssigneeId(c, people);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      frequencyDays: c.frequencyDays,
      frequencyLabel: frequencyLabel(c.frequencyDays),
      advanceDays: c.advanceDays,
      isActive: Boolean(c.isActive),
      assigneeId,
      assigneeName: assigneeId ? nameOf(assigneeId) : null,
      status: evaluateChore(c, now()),
      nextDueAt: nextDueAt(c, now()),
      lastCompletedAt: c.lastCompletedAt,
      lastCompletedByName: c.lastCompletedBy ? nameOf(c.lastCompletedBy) : null,
      completedCount: c.completedCount,
    };
  });

  return { items, frequencies: [1, 2, 7, 14, 30] };
}

function cleanChoreInput(input) {
  const name = typeof input?.name === 'string' ? input.name.trim().slice(0, 200) : '';
  if (!name) throw new EndpointError('A chore needs a name.', { code: 'EMPTY_NAME' });
  const freq = Math.min(365, Math.max(1, Math.round(Number(input?.frequencyDays) || 7)));
  const adv = Math.min(14, Math.max(0, Math.round(Number(input?.advanceDays) ?? 1)));
  return {
    name,
    description: typeof input?.description === 'string' ? input.description.trim().slice(0, 500) : null,
    frequencyDays: freq,
    advanceDays: adv,
  };
}

export async function createChore(input, createdBy) {
  const data = cleanChoreInput(input);
  await db.insert(chores).values({
    ...data,
    createdBy: createdBy ?? null,
    reminderLevel: 0,
    createdAt: now(),
  }).run();
  return listChores();
}

export async function updateChore(choreId, input) {
  const id = Number(choreId);
  const existing = await db.select().from(chores).where(eq(chores.id, id)).get();
  if (!existing) throw new EndpointError('Chore not found.', { code: 'NOT_FOUND' });

  const data = cleanChoreInput(input);
  const next = {
    name: data.name,
    description: data.description,
    frequencyDays: data.frequencyDays,
    advanceDays: data.advanceDays,
  };
  if (typeof input?.isActive === 'boolean') next.isActive = input.isActive;

  await db.update(chores).set(next).where(eq(chores.id, id)).run();
  return listChores();
}

export async function deleteChore(choreId) {
  const id = Number(choreId);
  // Children first (no foreign keys).
  await db.delete(choreCompletions).where(eq(choreCompletions.choreId, id)).run();
  await db.delete(chores).where(eq(chores.id, id)).run();
  return listChores();
}

/**
 * Mark a chore complete. Rotates the assignee for next time and resets reminders.
 */
export async function completeChore(choreId, completedBy) {
  const id = Number(choreId);
  const chore = await db.select().from(chores).where(eq(chores.id, id)).get();
  if (!chore) throw new EndpointError('Chore not found.', { code: 'NOT_FOUND' });

  await db.insert(choreCompletions).values({
    choreId: id,
    completedBy: completedBy ?? null,
    completedAt: now(),
  }).run();

  await db.update(chores)
    .set({
      lastCompletedAt: now(),
      lastCompletedBy: completedBy ?? null,
      completedCount: (chore.completedCount || 0) + 1,
      reminderLevel: 0,
    })
    .where(eq(chores.id, id))
    .run();

  return listChores();
}

/**
 * Evaluate all chores and send reminders to the assignee when the reminder
 * level advances. Returns the chores that were just reminded.
 *
 * Telegram Serverless has no cron: this runs on any bot interaction (a message,
 * or the Mini App opening). Reminders are therefore "lazy" — they fire the next
 * time either roommate touches the bot. Each level (upcoming / due / overdue)
 * fires at most once per cycle.
 */
export async function evaluateAndRemind() {
  const people = await ordered();
  if (people.length === 0) return [];

  const rows = await db.select().from(chores).all();
  const byId = new Map(people.map((p) => [p.id, p]));

  const reminded = [];
  for (const chore of rows) {
    if (chore.isActive === false) continue;

    const level = evaluateChore(chore, now());
    const levelNum = REMINDER_LEVELS[level];
    const current = chore.reminderLevel || 0;
    if (levelNum <= current) continue;

    const assigneeId = currentAssigneeId(chore, people);
    const assignee = assigneeId ? byId.get(assigneeId) : null;
    const name = assignee?.displayName || 'someone';

    const dueDate = new Date(nextDueAt(chore, now()) * 1000).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short',
    });
    let text;
    if (level === 'overdue') {
      text = `⚠️ *${chore.name}* was due ${dueDate} and hasn't been done.\n\n${name}, please take care of it. Use /chores to mark it done.`;
    } else if (level === 'due') {
      text = `🔔 *${chore.name}* is due today (${dueDate}).\n\n${name}, you're up! Use /chores to mark it done.`;
    } else {
      text = `📅 Reminder: *${chore.name}* is due ${dueDate}.\n\n${name}, that's yours this time.`;
    }

    if (assignee && assignee.tgId) {
      try {
        await api.sendMessage({ chat_id: assignee.tgId, text, parse_mode: 'Markdown' });
      } catch (err) {
        console.warn('chore reminder send failed', err && err.message ? err.message : err);
      }
    }

    await db.update(chores)
      .set({ reminderLevel: levelNum })
      .where(eq(chores.id, chore.id))
      .run();

    reminded.push({ id: chore.id, name: chore.name, level, assigneeId });
  }

  return reminded;
}
