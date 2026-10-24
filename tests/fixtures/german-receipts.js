// Representative German supermarket receipt extractions (synthetic fixtures —
// no real personal receipts). These are the shapes the AI provider is expected
// to return, used to test parsing, validation, reconciliation and allocation.

export const milkTeaFixture = {
  store: 'REWE',
  date: '2026-10-24',
  currency: 'EUR',
  total: '9,66',
  items: [
    { original: 'Vollmilch 3,5%', english: 'Whole milk 3.5%', quantity: '1', unit: 'Stück', unit_price: '1,09', line_total: '1,09', confidence: 0.98 },
    { original: 'Gouda jung', english: 'Young Gouda cheese', quantity: '1', unit: 'Stück', unit_price: '2,49', line_total: '2,49', confidence: 0.97 },
    { original: 'Schwarzer Tee', english: 'Black tea', quantity: '1', unit: 'Stück', unit_price: '2,29', line_total: '2,29', confidence: 0.96 },
    { original: 'Bananen', english: 'Bananas', quantity: '1', unit: 'kg', unit_price: '1,79', line_total: '1,79', confidence: 0.95 },
  ],
  adjustments: [],
};

export const pfandDiscountFixture = {
  store: 'EDEKA',
  date: '2026-10-23',
  currency: 'EUR',
  total: '20,90',
  items: [
    { original: 'Bio Eier 10er', english: 'Organic eggs (10)', quantity: '1', unit: 'Pack', unit_price: '3,79', line_total: '3,79', confidence: 0.99 },
    { original: 'Joghurt natur', english: 'Natural yoghurt', quantity: '2', unit: 'Stück', unit_price: '0,79', line_total: '1,58', confidence: 0.98 },
    { original: 'Mineralwasser 12x1l', english: 'Mineral water 12x1L', quantity: '1', unit: 'Kasten', unit_price: '4,50', line_total: '4,50', confidence: 0.97 },
  ],
  adjustments: [
    { kind: 'pfand', label: 'Pfand', amount: '3,00' },
    { kind: 'discount', label: 'Rabatt', amount: '-1,00' },
  ],
};

export const oddCentsFixture = {
  store: 'Aldi',
  date: '2026-10-22',
  currency: 'EUR',
  total: '2,29',
  items: [
    { original: 'Schwarzer Tee', english: 'Black tea', quantity: '1', unit: 'Stück', unit_price: null, line_total: '2,29', confidence: 0.9 },
  ],
  adjustments: [],
};
