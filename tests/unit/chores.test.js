import { describe, it, expect } from 'vitest';
import {
  nextDueAt, currentAssigneeId, evaluateChore, frequencyLabel, DAY_SECONDS,
} from '../../tgcloud/lib/chores/chores.js';

const A = { id: 1, tgId: 111, displayName: 'Ann' };
const B = { id: 2, tgId: 222, displayName: 'Bob' };
const people = [A, B];

describe('nextDueAt', () => {
  it('schedules the first due at createdAt + frequency', () => {
    const chore = { createdAt: 1000, frequencyDays: 7 };
    expect(nextDueAt(chore)).toBe(1000 + 7 * DAY_SECONDS);
  });

  it('reschedules from the last completion', () => {
    const chore = { createdAt: 1000, lastCompletedAt: 2000, frequencyDays: 7 };
    expect(nextDueAt(chore)).toBe(2000 + 7 * DAY_SECONDS);
  });
});

describe('currentAssigneeId', () => {
  it('assigns Person A first when never completed', () => {
    expect(currentAssigneeId({}, people)).toBe(A.id);
  });

  it('rotates after completion', () => {
    expect(currentAssigneeId({ lastCompletedBy: A.id }, people)).toBe(B.id);
    expect(currentAssigneeId({ lastCompletedBy: B.id }, people)).toBe(A.id);
  });

  it('handles a single participant', () => {
    expect(currentAssigneeId({}, [A])).toBe(A.id);
  });

  it('returns null with no participants', () => {
    expect(currentAssigneeId({}, [])).toBeNull();
  });
});

describe('evaluateChore', () => {
  const base = { createdAt: 0, lastCompletedAt: 0, frequencyDays: 7, advanceDays: 1, isActive: true };

  it('returns none long before due', () => {
    expect(evaluateChore(base, 1 * DAY_SECONDS)).toBe('none');
  });

  it('returns upcoming within the advance window', () => {
    // due at 7 days; advance 1 day -> upcoming from day 6
    expect(evaluateChore(base, 6 * DAY_SECONDS)).toBe('upcoming');
  });

  it('returns due on the due day', () => {
    expect(evaluateChore(base, 7 * DAY_SECONDS)).toBe('due');
  });

  it('returns overdue the day after', () => {
    expect(evaluateChore(base, 8 * DAY_SECONDS)).toBe('overdue');
  });

  it('returns none for inactive chores', () => {
    expect(evaluateChore({ ...base, isActive: false }, 8 * DAY_SECONDS)).toBe('none');
  });
});

describe('frequencyLabel', () => {
  it('labels common frequencies', () => {
    expect(frequencyLabel(1)).toBe('Every day');
    expect(frequencyLabel(7)).toBe('Every week');
    expect(frequencyLabel(14)).toBe('Every 2 weeks');
    expect(frequencyLabel(30)).toBe('Every month');
    expect(frequencyLabel(5)).toBe('Every 5 days');
  });
});
