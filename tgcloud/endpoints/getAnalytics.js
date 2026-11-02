// endpoints/getAnalytics.js — monthly spending breakdown by category and person.

import { EndpointError } from 'sdk';
import { requireParticipantByTgId, getOrderedParticipants } from '../lib/security/auth.js';
import { getAnalyticsData } from '../lib/store/analytics.js';

export default async function (input, ctx) {
  const user = ctx.initData && ctx.initData.user;
  if (!user) throw new EndpointError('Unauthorized.', { code: 'UNAUTHORIZED' });
  await requireParticipantByTgId(user.id);

  const month = input && input.month ? String(input.month) : null;
  const data = await getAnalyticsData(month);
  const { a, b } = await getOrderedParticipants();

  return {
    categories: data.categories,
    month: data.month,
    availableMonths: data.availableMonths,
    totalCents: data.totalCents,
    nameA: (a && a.displayName) || 'Person A',
    nameB: (b && b.displayName) || 'Person B',
    aShareCents: data.aShareCents,
    bShareCents: data.bShareCents,
    byCategory: data.byCategory,
    aShareByCategory: data.aShareByCategory,
    bShareByCategory: data.bShareByCategory,
  };
}
