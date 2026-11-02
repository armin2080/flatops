// categories.js — spending categories and deterministic keyword categorisation.
//
// Used to (a) pre-fill a suggested category for each receipt item, (b) validate
// AI-provided categories, and (c) power monthly analytics. Pure — no `sdk`.

export const CATEGORIES = [
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'produce', label: 'Fruits & Vegetables', emoji: '🍎' },
  { id: 'dairy', label: 'Dairy & Eggs', emoji: '🥛' },
  { id: 'bakery', label: 'Bakery', emoji: '🥖' },
  { id: 'meat', label: 'Meat & Fish', emoji: '🥩' },
  { id: 'beverages', label: 'Beverages', emoji: '🥤' },
  { id: 'snacks', label: 'Snacks & Sweets', emoji: '🍫' },
  { id: 'household', label: 'Household', emoji: '🏠' },
  { id: 'cleaning', label: 'Cleaning', emoji: '🧽' },
  { id: 'personal_care', label: 'Personal Care', emoji: '🧴' },
  { id: 'health', label: 'Health', emoji: '💊' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

const KEYWORD_CATEGORIES = [
  { id: 'dairy', words: ['milch', 'milk', 'käse', 'kaese', 'cheese', 'joghurt', 'yogurt', 'yoghurt', 'quark', 'butter', 'sahne', 'cream', 'eier', 'eggs', 'mozzarella', 'frischkäse', 'margarine', 'kefir', 'schlagsahne', 'gouda', 'edamer', 'emmentaler', 'camembert', 'cheddar', 'parmesan', 'feta', 'brie', 'mascarpone', 'ricotta'] },
  { id: 'produce', words: ['banane', 'banana', 'apfel', 'apple', 'tomate', 'tomato', 'gemüse', 'vegetable', 'obst', 'fruit', 'salat', 'salad', 'kartoffel', 'potato', 'zwiebel', 'onion', 'paprika', 'gurke', 'cucumber', 'karotte', 'carrot', 'avocado', 'beere', 'berry', 'zitrone', 'lemon', 'orange', 'erdbeere', 'strawberry', 'trauben', 'grape', 'spinat', 'spinach', 'brokkoli', 'broccoli', 'pilz', 'mushroom', 'knoblauch', 'garlic', 'ingwer', 'ginger'] },
  { id: 'bakery', words: ['brot', 'bread', 'brötchen', 'broetchen', 'roll', 'croissant', 'toast', 'baguette', 'laugen', 'backware', 'zopf', 'vollkorn'] },
  { id: 'meat', words: ['fleisch', 'meat', 'huhn', 'chicken', 'hähnchen', 'haehnchen', 'rind', 'beef', 'schwein', 'pork', 'wurst', 'sausage', 'fisch', 'fish', 'lachs', 'salmon', 'hackfleisch', 'salami', 'schinken', 'ham', 'puten', 'turkey', 'speck', 'bacon', 'thunfisch', 'tuna', 'garnelen', 'shrimp'] },
  { id: 'beverages', words: ['wasser', 'water', 'saft', 'juice', 'cola', 'limonade', 'lemonade', 'bier', 'beer', 'wein', 'wine', 'kaffee', 'coffee', 'tee', 'tea', 'energie', 'energy', 'mineralwasser', 'apfelschorle', 'smoothie', 'sprite', 'fanta', 'spezi', 'espresso', 'kakao', 'cocoa'] },
  { id: 'snacks', words: ['chips', 'schokolade', 'chocolate', 'kekse', 'cookie', 'keks', 'süßigkeit', 'suessigkeit', 'sweet', 'bonbon', 'gummi', 'nuss', 'nut', 'riegel', 'bar', 'eis', 'ice cream', 'kuchen', 'cake', 'popcorn', 'knabber', 'salzstange', 'chips', 'pralinen', 'erlebnispaket', 'kräuter', 'snack'] },
  { id: 'cleaning', words: ['reiniger', 'cleaner', 'spülmittel', 'spuelmittel', 'dish soap', 'waschmittel', 'detergent', 'desinfektion', 'bleich', 'badreiniger', 'allzweck', 'schwamm', 'sponge', 'müllbeutel', 'muellbeutel', 'trash bag', 'weichspüler', 'weichspueler', 'pulver', 'gel reiniger'] },
  { id: 'personal_care', words: ['zahnpasta', 'toothpaste', 'zahnbürste', 'toothbrush', 'shampoo', 'seife', 'soap', 'duschgel', 'shower gel', 'creme', 'lotion', 'deodorant', 'rasierer', 'razor', 'kosmetik', 'makeup', 'tampon', 'watte', 'lippen', 'sonnencreme', 'handcreme', 'deo'] },
  { id: 'health', words: ['medikament', 'medicine', 'vitamin', 'tabletten', 'tablets', 'pflaster', 'bandage', 'schmerzmittel', 'painkiller', 'apotheke', 'pharmacy', 'husten', 'cough', 'aspirin', 'ibuprofen', 'nasenspray', 'halstabletten'] },
  { id: 'household', words: ['papier', 'paper', 'küchenrolle', 'kuechenrolle', 'paper towel', 'toilettenpapier', 'toilet paper', 'serviette', 'napkin', 'folie', 'foil', 'batterie', 'battery', 'kerze', 'candle', 'glühbirne', 'gluehbirne', 'lightbulb', 'taschentuch', 'tissue', 'streichholz', 'match', 'gefrierbeutel', 'backpapier', 'mülltüte', 'muelltuete'] },
];

const KEYWORD_MAP = new Map();
for (const cat of KEYWORD_CATEGORIES) {
  for (const w of cat.words) KEYWORD_MAP.set(w, cat.id);
}

function normalizeWords(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Normalise an arbitrary value to a valid category id, or null.
 */
export function normalizeCategory(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (CATEGORY_IDS.has(v)) return v;
  const byLabel = CATEGORIES.find((c) => c.label.toLowerCase() === v);
  if (byLabel) return byLabel.id;
  return null;
}

/**
 * Deterministic keyword categoriser. Returns a category id (never null); falls
 * back to "other".
 */
export function categorizeItem(originalName, englishName) {
  const words = [...normalizeWords(originalName), ...normalizeWords(englishName)];
  if (words.length === 0) return 'other';

  // Longest-match first so "küchenrolle" wins over "papier", etc.
  const scored = [];
  for (const w of words) {
    for (const [key, id] of KEYWORD_MAP) {
      if (w.includes(key) || key.includes(w)) scored.push([key.length, id]);
    }
  }
  if (scored.length === 0) return 'other';
  scored.sort((a, b) => b[0] - a[0]);
  return scored[0][1];
}

/**
 * Public category list (id/label/emoji) for endpoints and prompts.
 */
export function categoryList() {
  return CATEGORIES.map(({ id, label, emoji }) => ({ id, label, emoji }));
}
