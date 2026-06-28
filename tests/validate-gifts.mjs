import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const requiredStringFields = [
  'id',
  'title',
  'category',
  'price',
  'description',
  'details',
  'marketUrl',
  'imageUrl'
];

const raw = await readFile(new URL('../gifts.json', import.meta.url), 'utf8');
const gifts = JSON.parse(raw);

if (!Array.isArray(gifts)) {
  throw new Error('gifts.json must contain an array');
}

if (gifts.length < 8) {
  throw new Error('gifts.json must contain at least 8 gifts');
}

const ids = new Set();

for (const gift of gifts) {
  for (const field of requiredStringFields) {
    if (typeof gift[field] !== 'string' || gift[field].trim() === '') {
      throw new Error(`Gift ${gift.id || '(missing id)'} has invalid ${field}`);
    }
  }

  if (ids.has(gift.id)) {
    throw new Error(`Duplicate gift id: ${gift.id}`);
  }

  ids.add(gift.id);
  new URL(gift.marketUrl);
  new URL(gift.imageUrl);
}

console.log(`Validated ${gifts.length} gifts`);
