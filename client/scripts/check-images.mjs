// Verifies every Unsplash photo used by the demo catalogue actually exists.
// Scans two sources for photo IDs (photo-<hex>-<hex>):
//   1. client/src/data/images.ts          (storefront photos: hero, banners, gallery, POOLS)
//   2. server/src/seed/catalog.js         (product and category photos seeded into the database)
// It checks each unique ID once with an HTTP HEAD request and reports which source(s) used it.
// Run from your own machine (needs internet):  npm run check:images
import { readFileSync } from 'node:fs';

const SOURCES = [
  { label: 'images.ts', file: new URL('../src/data/images.ts', import.meta.url) },
  { label: 'catalog.js', file: new URL('../../server/src/seed/catalog.js', import.meta.url) },
];

const usedIn = new Map(); // photo id -> Set of source labels
for (const { label, file } of SOURCES) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`Cannot read ${label}: ${err.message}`);
    console.error('Both client/src/data/images.ts and server/src/seed/catalog.js must exist (the server folder must sit next to client/).');
    process.exit(1);
  }
  for (const id of src.match(/photo-[0-9a-f]+-[0-9a-f]+/g) ?? []) {
    if (!usedIn.has(id)) usedIn.set(id, new Set());
    usedIn.get(id).add(label);
  }
}

const ids = [...usedIn.keys()];
console.log(`Checking ${ids.length} Unsplash photos (from ${SOURCES.map((s) => s.label).join(' and ')})...\n`);

let bad = 0, offline = 0;
for (const id of ids) {
  const where = `[${[...usedIn.get(id)].join(', ')}]`;
  const url = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&q=60`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    const ok = res.ok && type.startsWith('image/');
    if (!ok) bad++;
    console.log(`${ok ? 'OK     ' : 'BROKEN '} ${id}  (HTTP ${res.status})  ${where}`);
  } catch {
    offline++;
    console.log(`NO NET  ${id}  (could not reach images.unsplash.com)  ${where}`);
  }
}
if (offline) console.log('\nCould not reach Unsplash. Check your internet connection and run again.');
else if (bad) console.log(`\n${bad} broken photo ID(s). Replace them in client/src/data/images.ts (POOLS, HERO_IMAGE, MEN_BANNER, WOMEN_BANNER, PROMO_IMAGE) or in server/src/seed/catalog.js (POOLS).`);
else console.log('\nAll photos load.');
process.exit(bad || offline ? 1 : 0);
