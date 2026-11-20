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

// Hinweise (z. B. eine Art ohne Zeichnung oder ein Entwurf) dürfen die Veröffentlichung
// nicht blockieren; nur Fehler lassen diesen Test scheitern.
test('the real content builds without errors', () => {
  const list = [...result.errors, ...result.warnings].map((e) => `${e.file} ${e.line ?? ''} ${e.path}: ${e.message}`).join('\n');
  assert.ok(result.ok, list);
});

for (const region of result.regions || []) {
  const html = fs.readFileSync(path.join(result.out, region.path, 'index.html'), 'utf8');
  const name = `${region.kind.id}/${region.id}`;

  test(`${name}: ids are unique and every internal reference resolves`, () => {
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

  test(`${name}: one card per species and filter counts match`, () => {
    const cards = (html.match(/<article class="bird"/g) || []).length;
    assert.equal(cards, region.entries.length);
    const all = /data-g="alle"[^>]*>Alle <b>(\d+)<\/b>/.exec(html);
    if (all) assert.equal(Number(all[1]), cards);
  });

  test(`${name}: only species of its own animal type`, () => {
    const own = new Set(fs.readdirSync(path.join(ROOT, 'content', region.kind.dir)));
    const ids = [...html.matchAll(/<article class="bird" id="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length);
    for (const id of ids) assert.ok(own.has(id), `${id} gehört nicht zu ${region.kind.label}`);
  });

  test(`${name}: the finder lists months, sizes, colours and sites, and cards carry its data`, () => {
    assert.match(html, /<details class="finder" id="finder" hidden>/);
    assert.match(html, new RegExp(`<span class="finder-q">${region.kind.one} gesehen\\?</span>`));
    assert.equal((html.match(/data-m="\d+"/g) || []).length, 12);
    assert.equal((html.match(/data-s="[a-z]+"/g) || []).length, region.kind.size.classes.length);
    assert.equal((html.match(/<button type="button" data-c="/g) || []).length, 10);
    assert.equal((html.match(/<button type="button" data-o="/g) || []).length, region.sites.length);
    assert.equal((html.match(/class="site-find"/g) || []).length, region.sites.length);
    const cards = html.match(/<article class="bird"[^>]*>/g) || [];
    for (const c of cards) assert.match(c, /data-len="[\d. ]+" data-colors="[a-z ]+"/, c);
  });

  test(`${name}: canonical link uses SITE_URL`, () => {
    assert.match(html, new RegExp(`<link rel="canonical" href="https://example.github.io/birdwatching/${region.path}">`));
  });

  test(`${name}: the animal type switch marks this type and links to the same region`, () => {
    const nav = /<nav class="kinds"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    const kinds = new Set(result.regions.map((r) => r.kind));
    if (kinds.size < 2) return assert.equal(nav, null);
    assert.ok(nav, 'Auswahl der Tiergruppe fehlt');
    const current = [...nav[1].matchAll(/<a href="([^"]+)" aria-current="page">([^<]+)/g)];
    assert.equal(current.length, 1);
    assert.equal(current[0][1], '../'.repeat(region.path.split('/').filter(Boolean).length) + region.path);
    for (const other of result.regions.filter((r) => r.id === region.id && r !== region)) {
      const href = '../'.repeat(region.path.split('/').filter(Boolean).length) + other.path;
      assert.match(nav[1], new RegExp(`<a href="${href}">`), `${other.kind.label} derselben Region`);
    }
  });
}

test('each animal type has its own overview listing only its regions', () => {
  const kinds = [...new Set(result.regions.map((r) => r.kind))];
  for (const kind of kinds) {
    const html = fs.readFileSync(path.join(result.out, kind.path, 'index.html'), 'utf8');
    const links = [...html.matchAll(/<li class="region-card"><a href="([^"]+)"/g)].map((m) => m[1]);
    const own = result.regions.filter((r) => r.kind === kind);
    assert.equal(links.length, own.length, kind.id);
    const base = '../'.repeat(kind.path.split('/').filter(Boolean).length);
    assert.deepEqual(links, own.map((r) => base + r.path));
    if (kinds.length > 1) assert.match(html, new RegExp(`aria-current="page">${kind.label} <b>`));
  }
});

test('sitemap, 404 and assets are written', () => {
  const sitemap = fs.readFileSync(path.join(result.out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/example\.github\.io\/birdwatching\/<\/loc>/);
  for (const r of result.regions) assert.ok(sitemap.includes(`<loc>https://example.github.io/birdwatching/${r.path}</loc>`), r.path);
  // robots.txt wirkt nur an der Wurzel einer Domain
  assert.ok(!fs.existsSync(path.join(result.out, 'robots.txt')));
  assert.match(fs.readFileSync(path.join(result.out, '404.html'), 'utf8'), /href="\/birdwatching\/assets\/style\.css/);
  for (const f of ['assets/style.css', 'assets/guide.js', 'assets/favicon.svg', 'assets/fonts/bricolage-grotesque-latin.woff2', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(result.out, f)), f);
  }
});
