// Runs before `dev` and `build`: creates public/sky on first run so the project works straight after `npm install`.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

if (fs.existsSync('public/sky/meta.json') && fs.existsSync('public/sky/birth.json')) process.exit(0);
console.log('Sky data not found. Downloading star catalogue and building it (one time, about 1 minute)...');
const r = spawnSync(process.execPath, ['scripts/fetch-sky-sources.mjs'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
const b = spawnSync(
  process.execPath,
  ['scripts/build-sky-data.mjs', '.cache/hyg/hygdata_v41.csv', '.cache/celestial/constellations.json', '.cache/celestial/constellations.lines.json'],
  { stdio: 'inherit' },
);
process.exit(b.status ?? 1);
