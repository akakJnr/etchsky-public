// Downloads the raw star catalogue and constellation data into .cache/ (not committed).
// Run once before `npm run sky:build`, or use `npm run sky:data` for both.
import fs from 'node:fs';
import path from 'node:path';

const files = [
  ['https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv', '.cache/hyg/hygdata_v41.csv'],
  ['https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json', '.cache/celestial/constellations.json'],
  ['https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json', '.cache/celestial/constellations.lines.json'],
];

for (const [url, dest] of files) {
  if (fs.existsSync(dest)) { console.log('have', dest); continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  process.stdout.write(`fetching ${url} ... `);
  const r = await fetch(url);
  if (!r.ok) { console.error(`failed (${r.status})`); process.exit(1); }
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  console.log('ok');
}
