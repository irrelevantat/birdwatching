// Prüft die echte Website aus content/: baut sie in einen temporären Ordner
// und kontrolliert Links, ids und Inhalte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-site-'));
const result = build({ root: ROOT, out: path.join(out, '_site'), siteUrl: 'https://example.github.io/birdwatching' });

test('the real content builds without errors or warnings', () => {
  const list = [...result.errors, ...result.warnings].map((e) => `${e.file} ${e.path}: ${e.message}`).join('\n');
  assert.ok(result.ok, list);
  assert.equal(result.warnings.length, 0, list);
});

for (const region of result.regions || []) {
  const html = fs.readFileSync(path.join(result.out, region.id, 'index.html'), 'utf8');

  test(`${region.id}: ids are unique and every internal reference resolves`, () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `doppelte ids: ${dupes.join(', ')}`);
    const set = new Set(ids);
    const refs = [
      ...[...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
    ];
    const broken = refs.filter((r) => !set.has(r));
    assert.deepEqual(broken, [], `Verweise ohne Ziel: ${broken.join(', ')}`);
  });

  test(`${region.id}: one card per species and filter counts match`, () => {
    const cards = (html.match(/<article class="bird"/g) || []).length;
    assert.equal(cards, region.entries.length);
    const all = /data-g="alle"[^>]*>Alle <b>(\d+)<\/b>/.exec(html);
    if (all) assert.equal(Number(all[1]), cards);
  });

  test(`${region.id}: canonical link uses SITE_URL`, () => {
    assert.match(html, new RegExp(`<link rel="canonical" href="https://example.github.io/birdwatching/${region.id}/">`));
  });
}

test('sitemap, 404 and assets are written', () => {
  assert.match(fs.readFileSync(path.join(result.out, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/example\.github\.io\/birdwatching\/<\/loc>/);
  assert.match(fs.readFileSync(path.join(result.out, '404.html'), 'utf8'), /href="\/birdwatching\/assets\/style\.css/);
  for (const f of ['assets/style.css', 'assets/guide.js', 'assets/favicon.svg', 'assets/fonts/bricolage-grotesque-latin.woff2', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(result.out, f)), f);
  }
});
