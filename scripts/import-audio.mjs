// Import the published sprites only when they still match Studio's active approval.
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const source = resolve(process.argv[2] ?? '../dopamine-learning-machine');
const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = read(resolve(source, 'public/audio/manifest.json'));
const library = read(resolve(source, '.voice-admin/library.json'));
const clips = {};
const files = new Set();
for (const [id, clip] of Object.entries(manifest.clips)) {
  if (!/^(name|pair|word)-/.test(id)) continue;
  const entry = library[id];
  const take = entry?.takes.find((take) => take.id === entry.activeTakeId);
  if (!clip.available || !clip.reviewed || !take?.approved || clip.takeId !== take.id) continue;
  if (!/^\/audio\/[\w-]+\.(mp3|wav)$/.test(clip.file)) throw Error(`Invalid audio path: ${id}`);
  if (!Number.isFinite(clip.start) || clip.start < 0 || !(clip.duration > 0)) throw Error(`Invalid sprite: ${id}`);
  // Take wording describes the actual recording, even if the catalog was edited later.
  const text = take.settings.text.replace(/<[^>]*>/g, '').trim();
  clips[id] = { file: `audio/${basename(clip.file)}`, start: clip.start, duration: clip.duration, text, takeId: take.id };
  files.add(clip.file);
}
mkdirSync(new URL('public/audio/', root), { recursive: true });
for (const file of files) copyFileSync(resolve(source, `public${file}`), new URL(`public/audio/${basename(file)}`, root));
writeFileSync(new URL('src/data/audio.json', root), JSON.stringify({ source: 'dopamine-learning-machine approved Studio takes', clips }, null, 2) + '\n');
for (const kind of ['name', 'pair', 'word']) console.log(`${kind}: ${Object.keys(clips).filter(id => id.startsWith(kind + '-')).length}`);
console.log(`Copied ${files.size} sprite packs.`);
