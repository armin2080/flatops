// chores.js — pure logic for recurring household routines (no `sdk`).
//
// A chore recurs every `frequencyDays`. The assignee rotates deterministically:
// whoever did NOT complete it last does it next. If it has never been done, the
// first participant (Person A) takes it.

export const DAY_SECONDS = 86400;

/**
 * When is a chore next due? After the last completion + frequency; if never
 * completed, the first due date is `createdAt + frequencyDays`.
 */
export function nextDueAt(chore, now = Math.floor(Date.now() / 1000)) {
  const base = chore.lastCompletedAt ?? chore.createdAt ?? now;
  const freq = Math.max(1, Math.round(chore.frequencyDays || 7));
  return base + freq * DAY_SECONDS;
}

/**
 * Deterministic assignee id for a chore.
 * `participants` is the ordered [personA, personB] array.
 */
export function currentAssigneeId(chore, participants = []) {
  const active = participants.filter(Boolean);
  if (active.length === 0) return null;
  const [a, b] = active;
  if (!b) return a.id;
  if (chore.lastCompletedBy === a.id) return b.id;
  if (chore.lastCompletedBy === b.id) return a.id;
  return a.id; // never completed — start with Person A
}

/**
 * Evaluate a chore's reminder state.
 * Returns 'overdue' | 'due' | 'upcoming' | 'none'.
 */
export function evaluateChore(chore, now = Math.floor(Date.now() / 1000)) {
  if (chore.isActive === false) return 'none';
  const due = nextDueAt(chore, now);
  const advance = Math.max(0, Math.round(chore.advanceDays || 0)) * DAY_SECONDS;

  if (now >= due + DAY_SECONDS) return 'overdue';
  if (now >= due) return 'due';
  if (now >= due - advance) return 'upcoming';
  return 'none';
}

/**
 * The reminder levels, ordered. A reminder fires once per level (the level is
 * persisted on the chore so we don't re-send on every interaction).
 */
export const REMINDER_LEVELS = { none: 0, upcoming: 1, due: 2, overdue: 3 };

/**
 * Human label for a frequency, e.g. 7 -> "Every week".
 */
export function frequencyLabel(frequencyDays) {
  const d = Math.round(frequencyDays || 7);
  if (d === 1) return 'Every day';
  if (d === 2) return 'Every 2 days';
  if (d === 7) return 'Every week';
  if (d === 14) return 'Every 2 weeks';
  if (d === 30) return 'Every month';
  return `Every ${d} days`;
}

/**
 * Preset frequencies offered in the UI.
 */
export const FREQUENCY_PRESETS = [
  { days: 1, label: 'Daily' },
  { days: 2, label: 'Every 2 days' },
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
];
