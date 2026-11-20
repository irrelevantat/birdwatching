// Prüft die echte Website aus content/: baut sie in einen temporären Ordner und
// kontrolliert alle erzeugten Seiten (ids, Links, Bilder, Menü) und den Aufbau
// jeder Region: Hauptseite mit „Vogel gesehen?“, Steckbriefe und Unterseiten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { COLORS, SIZE_CLASSES } from '../scripts/lib/finder.mjs';
import { esc } from '../scripts/lib/text.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE_URL = 'https://example.github.io/birdwatching';
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-site-'));
const result = build({ root: ROOT, out: path.join(out, '_site'), siteUrl: SITE_URL });

// Unterseiten einer Region: Schlüssel im Menü (class="nav-…") → Ordner
const SUBPAGES = { orte: 'orte/', season: 'wann-und-wie/', more: 'weitere-arten/', sources: 'quellen/' };
// Sprungmarken der früheren Einzelseite; guide.js leitet sie über data-old weiter
const OLD_HASH = { orte: 'orte', season: 'praxis', more: 'mehr', sources: 'quellen' };

// ---------------------------------------------------------------------------
// Hilfen

/** Alle HTML-Seiten unter `dir`, relativ und mit „/“ getrennt. */
function htmlPages(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefix + e.name;
    if (e.isDirectory()) return htmlPages(path.join(dir, e.name), rel + '/');
    return e.name.endsWith('.html') ? [rel] : [];
  });
}
const pages = result.ok ? htmlPages(result.out).sort() : [];

const texts = new Map();
/** Inhalt einer erzeugten Datei (relativ zum Ausgabeordner). */
function read(rel) {
  if (!texts.has(rel)) texts.set(rel, fs.readFileSync(path.join(result.out, rel), 'utf8'));
  return texts.get(rel);
}

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Alle ids einer Seite (auch in eingebetteten SVGs, auch mit einfachen Anführungszeichen). */
const idList = (html) => [...html.matchAll(/\sid\s*=\s*(["'])(.*?)\1/g)].map((m) => unescape(m[2]));
const idSets = new Map();
function idsOf(rel) {
  if (!idSets.has(rel)) idSets.set(rel, new Set(idList(read(rel))));
  return idSets.get(rel);
}

/** href- und src-Werte einer Seite, auch xlink:href in SVGs. */
const refs = (html) => [...html.matchAll(/[\s:](?:href|src)\s*=\s*(["'])(.*?)\1/g)].map((m) => unescape(m[2]));

/** Verweise auf ids derselben Seite ohne Link: url(#…), aria-labelledby, for … */
const idRefs = (html) => [
  ...[...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
  ...[...html.matchAll(/\s(?:aria-labelledby|aria-describedby|aria-controls|for)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
];

const BASE = new URL(`${SITE_URL}/`);

/**
 * Ziel eines Links von der Seite `from` aus: { file, hash } relativ zum Ausgabeordner
 * (Ordner → index.html, ?… zählt nicht), { outside: true } für Pfade außerhalb der
 * Website oder null für andere Adressen (https:, mailto: …).
 */
function target(from, ref) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return null;
  const u = new URL(ref, new URL(from, BASE));
  if (u.origin !== BASE.origin || !u.pathname.startsWith(BASE.pathname)) return { outside: true };
  let file = decodeURIComponent(u.pathname.slice(BASE.pathname.length));
  const abs = path.join(result.out, file);
  if (file === '' || file.endsWith('/') || (fs.existsSync(abs) && fs.statSync(abs).isDirectory())) file = path.posix.join(file, 'index.html');
  return { file, hash: decodeURIComponent(u.hash.slice(1)) };
}

/** Wert eines Attributs in einem Start-Tag (unescaped) oder undefined. */
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescape(m[1]) : undefined;
};

/** Menüpunkte einer Seite: [{ key, href, on, current, old }] in Reihenfolge. */
function navOf(html) {
  const nav = /<nav class="regnav"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  if (!nav) return null;
  return [...nav[1].matchAll(/<a [^>]*>/g)].map(([tag]) => ({
    key: /class="nav-([a-z]+)/.exec(tag)?.[1],
    href: attr(tag, 'href'),
    on: /class="nav-[a-z]+ on"/.test(tag),
    current: attr(tag, 'aria-current'),
    old: attr(tag, 'data-old'),
  }));
}

// ---------------------------------------------------------------------------
// Ganze Website

// Hinweise (z. B. eine Art ohne Zeichnung oder ein Entwurf) dürfen die Veröffentlichung
// nicht blockieren; nur Fehler lassen diesen Test scheitern.
test('the real content builds without errors', () => {
  const list = [...result.errors, ...result.warnings].map((e) => `${e.file} ${e.line ?? ''} ${e.path}: ${e.message}`).join('\n');
  assert.ok(result.ok, list);
});

test('the build reports exactly the HTML pages it wrote', () => {
  assert.deepEqual(pages, [...result.pages].sort());
  assert.ok(pages.includes('index.html') && pages.includes('404.html'));
});

test('every page has unique ids, a title and one main heading', () => {
  const problems = [];
  for (const rel of pages) {
    const html = read(rel);
    const list = idList(html);
    const dupes = [...new Set(list.filter((id, i) => list.indexOf(id) !== i))];
    if (dupes.length) problems.push(`${rel}: doppelte ids ${dupes.join(', ')}`);
    if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: <title> fehlt`);
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) problems.push(`${rel}: ${h1}× <h1>`);
    if (!/<main id="inhalt"/.test(html)) problems.push(`${rel}: <main id="inhalt"> fehlt (Sprunglink „Zum Inhalt“)`);
  }
  assert.deepEqual(problems, []);
});

test('every internal link, image and id reference resolves', () => {
  const problems = [];
  let checked = 0;
  for (const rel of pages) {
    const html = read(rel);
    for (const ref of refs(html)) {
      const t = target(rel, ref);
      if (!t) continue;
      checked++;
      if (t.outside) {
        problems.push(`${rel}: „${ref}“ führt aus der Website hinaus`);
      } else if (!fs.existsSync(path.join(result.out, t.file))) {
        problems.push(`${rel}: „${ref}“ → ${t.file} fehlt`);
      } else if (t.hash && !idsOf(t.file).has(t.hash)) {
        problems.push(`${rel}: „${ref}“ → ${t.file} hat keine id „${t.hash}“`);
      }
    }
    for (const id of idRefs(html)) {
      if (!idsOf(rel).has(id)) problems.push(`${rel}: Verweis auf fehlende id „${id}“`);
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(checked > 100, `nur ${checked} interne Links geprüft`);
});

test('canonical links use SITE_URL on every page except 404', () => {
  for (const rel of pages) {
    const html = read(rel);
    if (rel === '404.html') {
      assert.doesNotMatch(html, /rel="canonical"/);
      assert.match(html, /<meta name="robots" content="noindex">/);
      continue;
    }
    const want = `${SITE_URL}/${rel.slice(0, -'index.html'.length)}`;
    assert.equal(/<link rel="canonical" href="([^"]+)">/.exec(html)?.[1], want, rel);
  }
});

test('the sitemap lists every page except 404', () => {
  const xml = fs.readFileSync(path.join(result.out, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const want = pages.filter((p) => p !== '404.html').map((p) => `${SITE_URL}/${p.slice(0, -'index.html'.length)}`).sort();
  assert.deepEqual(locs, want);
  for (const region of result.regions || []) {
    for (const e of region.entries) assert.ok(locs.includes(`${SITE_URL}/${region.id}/arten/${e.id}/`), e.id);
  }
});

test('links into „Vogel gesehen?“ only use parameters that guide.js reads', () => {
  const guide = fs.readFileSync(path.join(ROOT, 'assets', 'guide.js'), 'utf8');
  const known = new Set([...guide.matchAll(/p\.get\('([a-z]+)'\)/g)].map((m) => m[1]));
  assert.deepEqual([...known].sort(), ['farben', 'groesse', 'lebensraum', 'monat', 'ort']);
  let found = 0;
  for (const rel of pages) {
    for (const ref of refs(read(rel))) {
      const t = target(rel, ref);
      // nur Links auf eine Seite mit „Vogel gesehen?“ (nicht z. B. style.css?v=…)
      if (!t || t.outside || !ref.includes('?') || !t.file.endsWith('.html') || !idsOf(t.file).has('finder')) continue;
      found++;
      const params = new URLSearchParams(ref.split('?')[1].split('#')[0]);
      for (const key of params.keys()) assert.ok(known.has(key), `${rel}: ${ref}`);
      // ort=… muss ein Ort auf der Zielseite sein
      const ort = params.get('ort');
      if (ort) assert.ok(read(t.file).includes(` data-o="${ort}" `), `${rel}: ${ref}`);
    }
  }
  assert.ok(found > 0);
});

test('sitemap, 404 and assets are written', () => {
  assert.match(fs.readFileSync(path.join(result.out, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/example\.github\.io\/birdwatching\/<\/loc>/);
  // robots.txt wirkt nur an der Wurzel einer Domain
  assert.ok(!fs.existsSync(path.join(result.out, 'robots.txt')));
  assert.match(fs.readFileSync(path.join(result.out, '404.html'), 'utf8'), /href="\/birdwatching\/assets\/style\.css/);
  for (const f of ['assets/style.css', 'assets/guide.js', 'assets/favicon.svg', 'assets/fonts/bricolage-grotesque-latin.woff2', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(result.out, f)), f);
  }
});

// ---------------------------------------------------------------------------
// Jede Region

for (const region of result.regions || []) {
  const R = region.id;
  const home = read(`${R}/index.html`);
  const entries = region.entries;
  const regionPages = pages.filter((p) => p.startsWith(`${R}/`));
  const speciesPage = (id) => `${R}/arten/${id}/index.html`;

  // Erwartete Reihenfolge der Liste: nach Hauptgruppe (wie unter groups), darin wie unter birds
  const mainGroups = region.groups.filter((g) => entries.some((e) => e.group === g.id));
  const order = mainGroups.length
    ? [...mainGroups.flatMap((g) => entries.filter((e) => e.group === g.id)), ...entries.filter((e) => !mainGroups.some((g) => g.id === e.group))]
    : entries;
  // Lebensräume in „Vogel gesehen?“: jede Gruppe mit mindestens einer Art (auch als zweite Gruppe)
  const habitats = region.groups.filter((g) => entries.some((e) => e.groups.includes(g.id)));

  const cardTags = [...home.matchAll(/<article class="bird"[^>]*>/g)].map((m) => m[0]);
  const cards = [...home.matchAll(/<article class="bird"[^>]*>[\s\S]*?<\/article>/g)].map((m) => m[0]);

  // Welche Unterseiten Inhalt haben
  const has = {
    orte: region.sites.length > 0 || !!region.map,
    season: !!(region.season?.rows?.length || region.season?.note || region.tips?.items?.length),
    more: !!region.more?.groups?.length,
    sources: true,
  };

  test(`${R}: the home page shows one compact card per species, grouped by main habitat`, () => {
    assert.equal(cards.length, entries.length);
    assert.deepEqual(cardTags.map((t) => attr(t, 'id')), order.map((e) => e.id));
    // Überschriften der Lebensräume mit Anzahl
    const heads = [...home.matchAll(/<h3 class="tier grp">([^<]+) <span>(\d+) Arte?n?<\/span><\/h3>/g)].map((m) => [unescape(m[1]), Number(m[2])]);
    if (mainGroups.length) {
      assert.deepEqual(heads.slice(0, mainGroups.length), mainGroups.map((g) => [g.label, entries.filter((e) => e.group === g.id).length]));
    } else {
      assert.deepEqual(heads, [['Alle Arten', entries.length]]);
    }
    order.forEach((e, i) => {
      const card = cards[i];
      // Name verlinkt den Steckbrief (guide.js leitet alte Adressen …/#<art> darüber weiter)
      assert.match(card, new RegExp(`<h4 class="bird-name"><a href="arten/${e.id}/">${esc(e.bird.name)}</a></h4>`), e.id);
      // Vorschaubild ist Beiwerk zum Namen: Bilder ohne Alternativtext, Zeichnungen ohne Beschriftung
      const thumb = /<div class="thumb">([\s\S]*?)<div class="bird-body">/.exec(card)?.[1];
      assert.ok(thumb && /<svg |<img /.test(thumb), `${e.id}: Vorschaubild fehlt`);
      for (const img of thumb.match(/<img [^>]*>/g) || []) assert.match(img, /\salt=""/, `${e.id}: ${img}`);
      for (const svg of thumb.match(/<svg [^>]*>/g) || []) assert.match(svg, /\saria-hidden="true"/, `${e.id}: ${svg}`);
      if (e.local) assert.ok(card.includes(`<span class="local">${esc(e.local)}</span>`), e.id);
    });
    // Die Hauptseite ist kompakt: keine Steckbrief-Inhalte
    assert.doesNotMatch(home, /<ol class="marks">|class="credit"|class="slides"/);
    if (region.lead) assert.match(home, new RegExp(`<h2 id="ueber">Über ${esc(region.name)}</h2>`));
  });

  test(`${R}: every species has its own page with back link and pager`, () => {
    const dirs = fs.readdirSync(path.join(result.out, R, 'arten')).sort();
    assert.deepEqual(dirs, entries.map((e) => e.id).sort());
    order.forEach((e, i) => {
      const html = read(speciesPage(e.id));
      const bird = e.bird;
      assert.match(html, new RegExp(`<h1>${esc(bird.title || bird.name)}</h1>`), e.id);
      assert.match(html, /<p class="back"><a href="\.\.\/\.\.\/" data-back>← Alle Arten<\/a><\/p>/, e.id);
      assert.match(html, /<article class="sp">/, e.id);
      assert.ok(html.includes(`<i>${esc(bird.scientific)}</i>`), e.id);
      // Blättern in der Reihenfolge der Liste
      const prev = /<a rel="prev" href="\.\.\/([^/]+)\/">/.exec(html)?.[1];
      const next = /<a rel="next" href="\.\.\/([^/]+)\/">/.exec(html)?.[1];
      assert.equal(prev, order[i - 1]?.id, `${e.id}: vorige Art`);
      assert.equal(next, order[i + 1]?.id, `${e.id}: nächste Art`);
      // Gute Orte: je Ort ein Link zur Beschreibung auf der Seite „Orte“
      const siteLinks = [...html.matchAll(/<a href="\.\.\/\.\.\/orte\/#([^"]+)">/g)].map((m) => m[1]);
      assert.deepEqual(siteLinks, (e.siteIdx || []).map((k) => region.sites[k].slug), e.id);
      // Lebensräume als Kärtchen
      const habs = [...html.matchAll(/<li class="hab">([^<]+)<\/li>/g)].map((m) => unescape(m[1]));
      assert.deepEqual(habs, e.groups.map((id) => region.groups.find((g) => g.id === id).label), e.id);
      // Monatsleiste nur bei Arten, die nicht ganzjährig da sind
      assert.equal(/<h2 class="k">Wann hier<\/h2>/.test(html), !!(e.monthSet && e.monthSet.size < 12), e.id);
    });
  });

  test(`${R}: the finder asks for colours, size, habitat, site and month, and cards carry its data`, () => {
    assert.match(home, /<section class="finder" id="finder" aria-labelledby="finder-h" hidden>/);
    // Reihenfolge der Fragen
    const rows = [...home.matchAll(/<div class="opts (o-[a-z]+)">/g)].map((m) => m[1]);
    assert.deepEqual(rows, ['o-colors', 'o-sizes', habitats.length ? 'o-habitats' : null, region.sites.length ? 'o-sites' : null, 'o-months'].filter(Boolean));
    assert.equal((home.match(/<button type="button" data-c="/g) || []).length, COLORS.length);
    assert.equal((home.match(/<button type="button" data-s="/g) || []).length, SIZE_CLASSES.length);
    assert.equal((home.match(/<button type="button" data-m="\d+"/g) || []).length, 12);
    assert.equal((home.match(/<button type="button" data-o="/g) || []).length, region.sites.length);
    // Lebensraum: ein Knopf je Gruppe mit Arten, beschriftet wie die Gruppe
    const habitatBtns = [...home.matchAll(/<button type="button" data-l="([^"]+)" aria-pressed="false">([^<]+)<\/button>/g)].map((m) => [m[1], unescape(m[2])]);
    assert.deepEqual(habitatBtns, habitats.map((g) => [g.id, g.label]));
    // Teile, auf die guide.js angewiesen ist
    for (const part of ['class="finder-status"', 'class="finder-reset"', '<section class="species" id="arten"', '<div class="grid">']) assert.ok(home.includes(part), part);
    // Daten jeder Artkarte
    order.forEach((e, i) => {
      const tag = cardTags[i];
      const bird = e.bird;
      assert.equal(attr(tag, 'data-len'), bird.len?.join(' '), e.id);
      assert.equal(attr(tag, 'data-colors'), bird.colorIds?.length ? bird.colorIds.join(' ') : undefined, e.id);
      assert.equal(attr(tag, 'data-groups'), e.groups.length ? e.groups.join(' ') : undefined, e.id);
      assert.equal(attr(tag, 'data-sites'), region.sites.length ? (e.siteIdx || []).join(' ') : undefined, e.id);
      const partial = e.monthSet && e.monthSet.size < 12;
      assert.equal(attr(tag, 'data-months'), partial ? [...e.monthSet].sort((a, b) => a - b).join(' ') : undefined, e.id);
    });
    // „Vogel gesehen?“ und die Artkarten gibt es nur auf der Hauptseite
    for (const rel of regionPages.filter((p) => p !== `${R}/index.html`)) {
      assert.doesNotMatch(read(rel), /id="finder"|<article class="bird"/, rel);
    }
  });

  test(`${R}: the menu lists the subpages with content and marks the current one`, () => {
    for (const [key, dir] of Object.entries(SUBPAGES)) {
      assert.equal(fs.existsSync(path.join(result.out, R, dir, 'index.html')), has[key], dir);
    }
    const expected = ['find', ...Object.keys(SUBPAGES).filter((k) => has[k])];
    // Seiten der Region: Hauptseite, Steckbriefe und Unterseiten, sonst nichts
    assert.equal(regionPages.length, 1 + entries.length + expected.length - 1);
    for (const rel of regionPages) {
      const nav = navOf(read(rel));
      assert.ok(nav, `${rel}: Menü fehlt`);
      assert.deepEqual(nav.map((n) => n.key), expected, rel);
      const sub = Object.keys(SUBPAGES).find((k) => rel === `${R}/${SUBPAGES[k]}index.html`);
      const isSpecies = rel.startsWith(`${R}/arten/`);
      // Steckbriefe gehören zu „Vogel gesehen?“, sind aber nicht die Seite selbst
      assert.deepEqual(nav.filter((n) => n.on).map((n) => n.key), [sub || 'find'], rel);
      assert.deepEqual(nav.filter((n) => n.current === 'page').map((n) => n.key), isSpecies ? [] : [sub || 'find'], rel);
      for (const n of nav) {
        assert.equal(n.old, OLD_HASH[n.key], `${rel}: data-old von nav-${n.key}`);
        const t = target(rel, n.href);
        assert.equal(t.file, n.key === 'find' ? `${R}/index.html` : `${R}/${SUBPAGES[n.key]}index.html`, `${rel}: nav-${n.key}`);
      }
      // Marke in der Kopfleiste führt zur Hauptseite der Region
      const brand = /<a href="([^"]*)" class="brand-region">/.exec(read(rel))?.[1];
      assert.equal(target(rel, brand).file, `${R}/index.html`, rel);
    }
    // Startseite der Website verlinkt die Region
    assert.ok(read('index.html').includes(`<a href="${R}/">`));
  });

  test(`${R}: the places page links every site to the finder`, { skip: !region.sites.length }, () => {
    const html = read(`${R}/orte/index.html`);
    const slugs = region.sites.map((s) => s.slug);
    assert.deepEqual([...html.matchAll(/<li class="site" id="([^"]+)">/g)].map((m) => m[1]), slugs);
    assert.deepEqual(
      [...html.matchAll(/<a class="site-find" href="([^"]+)">/g)].map((m) => unescape(m[1])),
      slugs.map((s) => `../?ort=${s}#finder`),
    );
    // Die Ortsangabe ist auf der Hauptseite auswählbar
    for (const s of slugs) assert.ok(home.includes(` data-o="${s}" `), s);
    // Nummern auf der Karte führen zum Ort
    if (region.map) {
      const pins = [...html.matchAll(/<a href="#([^"]+)" class="pin" aria-label="([^"]+)">/g)].map((m) => [m[1], unescape(m[2])]);
      const want = region.sites.map((s, i) => (s.pin ? [s.slug, `${i + 1}: ${s.name}`] : null)).filter(Boolean);
      assert.deepEqual(pins, want);
    }
    // Typische Arten verlinken ihre Steckbriefe
    for (const s of region.sites) {
      for (const id of s.birds || []) assert.ok(html.includes(`<a href="../arten/${id}/">`), `${s.name}: ${id}`);
    }
  });

  test(`${R}: nothing of the old single page is left`, () => {
    for (const rel of regionPages) {
      const html = read(rel);
      assert.doesNotMatch(html, /class="filters"|data-g=|<details class="finder"/, rel);
    }
    // Die Karte auf der Startseite der Website liegt in einem Link und hat keine eigenen Links
    assert.doesNotMatch(read('index.html'), /class="pin"/);
  });
}
