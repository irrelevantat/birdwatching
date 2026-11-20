// Prüft die echte Website aus content/: baut sie in einen temporären Ordner und
// kontrolliert alle erzeugten Seiten (ids, Links, Bilder, Menü, Auswahl der Tiergruppe),
// die Übersicht je Tiergruppe und den Aufbau jeder Region aller Tiergruppen: Hauptseite
// mit „Vogel gesehen?“ (bzw. „Schmetterling gesehen?“), Steckbriefe und Unterseiten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { COLORS } from '../scripts/lib/finder.mjs';
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

/** Menüpunkte einer Seite: [{ key, href, on, current, old, label }] in Reihenfolge. */
function navOf(html) {
  const nav = /<nav class="regnav"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  if (!nav) return null;
  return [...nav[1].matchAll(/(<a [^>]*>)[\s\S]*?<span>([^<]*)<\/span><\/a>/g)].map(([, tag, label]) => ({
    key: /class="nav-([a-z]+)/.exec(tag)?.[1],
    href: attr(tag, 'href'),
    on: /class="nav-[a-z]+ on"/.test(tag),
    current: attr(tag, 'aria-current'),
    old: attr(tag, 'data-old'),
    label: unescape(label),
  }));
}

/** Auswahl der Tiergruppe einer Seite: [{ href, current, label, count }] oder null. */
function kindsOf(html) {
  const nav = /<nav class="kinds" aria-label="Tiergruppe wählen"><ul>([\s\S]*?)<\/ul><\/nav>/.exec(html);
  if (!nav) return null;
  return [...nav[1].matchAll(/<li><a( [^>]*)>([^<]*?)(?: <b>(\d+)<\/b>)?<\/a><\/li>/g)].map(([, attrs, label, count]) => ({
    href: attr(attrs, 'href'),
    current: attr(attrs, 'aria-current'),
    label: unescape(label),
    count: count === undefined ? undefined : Number(count),
  }));
}

/** Artname wie auf den Seiten: ist er der wissenschaftliche Name, kursiv. */
const nameHtml = (sp, text = sp.name) => (text === sp.scientific ? `<i>${esc(text)}</i>` : esc(text));
/** „../“ bis zur Wurzel der Website von einem Ordner wie „schmetterlinge/ometepe/“ aus. */
const upFrom = (dir) => '../'.repeat(dir.split('/').filter(Boolean).length);

// Tiergruppen mit Regionen (in der Reihenfolge der Auswahl oben)
const kinds = [...new Set((result.regions || []).map((r) => r.kind))];

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
  // je Tiergruppe eine Übersicht
  for (const kind of kinds) assert.ok(pages.includes(`${kind.path}index.html`), kind.id);
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
  for (const kind of kinds) assert.ok(locs.includes(`${SITE_URL}/${kind.path}`), kind.id);
  for (const region of result.regions || []) {
    assert.ok(locs.includes(`${SITE_URL}/${region.path}`), region.path);
    for (const e of region.entries) assert.ok(locs.includes(`${SITE_URL}/${region.path}arten/${e.id}/`), `${region.path} ${e.id}`);
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

test('links into „… gesehen?“ only use parameters that guide.js reads', () => {
  const guide = fs.readFileSync(path.join(ROOT, 'assets', 'guide.js'), 'utf8');
  const known = new Set([...guide.matchAll(/p\.get\('([a-z]+)'\)/g)].map((m) => m[1]));
  assert.deepEqual([...known].sort(), ['farben', 'groesse', 'lebensraum', 'monat', 'ort']);
  let found = 0;
  for (const rel of pages) {
    for (const ref of refs(read(rel))) {
      const t = target(rel, ref);
      // nur Links auf eine Seite mit „… gesehen?“ (nicht z. B. style.css?v=…)
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

// ---------------------------------------------------------------------------
// Tiergruppen

test('each animal type has its own overview listing only its regions', () => {
  for (const kind of kinds) {
    const html = read(`${kind.path}index.html`);
    const links = [...html.matchAll(/<li class="region-card"><a href="([^"]+)"/g)].map((m) => m[1]);
    const own = result.regions.filter((r) => r.kind === kind);
    assert.equal(links.length, own.length, kind.id);
    assert.deepEqual(links, own.map((r) => upFrom(kind.path) + r.path));
    if (kinds.length > 1) assert.match(html, new RegExp(`aria-current="page">${kind.label} <b>`));
    // Die Karten der Regionen sind Bilder in einem Link, ohne eigene Links
    assert.doesNotMatch(html, /class="pin"/, kind.id);
  }
});

test('every page except 404 offers the animal types; an overview marks its own type', () => {
  if (kinds.length < 2) {
    for (const rel of pages) assert.equal(kindsOf(read(rel)), null, rel);
    return;
  }
  for (const rel of pages) {
    const sw = kindsOf(read(rel));
    if (rel === '404.html') continue;
    assert.ok(sw, `${rel}: Auswahl der Tiergruppe fehlt`);
    assert.equal(sw.length, kinds.length, rel);
    assert.equal(sw.filter((s) => s.current).length, 1, `${rel}: genau eine Tiergruppe ist markiert`);
  }
  for (const kind of kinds) {
    const rel = `${kind.path}index.html`;
    const sw = kindsOf(read(rel));
    // Auf den Übersichten führt jeder Eintrag zur Übersicht seiner Tiergruppe
    assert.deepEqual(sw.map((s) => target(rel, s.href).file), kinds.map((k) => `${k.path}index.html`), rel);
    assert.deepEqual(sw.map((s) => s.current), kinds.map((k) => (k === kind ? 'page' : undefined)), rel);
    // Anzahl der Arten je Tiergruppe
    assert.deepEqual(sw.map((s) => s.count), kinds.map((k) => new Set(result.regions.filter((r) => r.kind === k).flatMap((r) => r.entries.map((e) => e.id))).size), rel);
  }
});

// ---------------------------------------------------------------------------
// Jede Region jeder Tiergruppe

for (const region of result.regions || []) {
  const kind = region.kind;
  // Ordner der Region, z. B. „ometepe/“ oder „schmetterlinge/ometepe/“
  const P = region.path;
  const R = `${kind.id}/${region.id}`;
  const home = read(`${P}index.html`);
  const entries = region.entries;
  const regionPages = pages.filter((p) => p.startsWith(P));
  const speciesPage = (id) => `${P}arten/${id}/index.html`;

  // Erwartete Reihenfolge der Liste: nach Hauptgruppe (wie unter groups), darin wie in der Regionsdatei
  const mainGroups = region.groups.filter((g) => entries.some((e) => e.group === g.id));
  const order = mainGroups.length
    ? [...mainGroups.flatMap((g) => entries.filter((e) => e.group === g.id)), ...entries.filter((e) => !mainGroups.some((g) => g.id === e.group))]
    : entries;
  // Lebensräume in „… gesehen?“: jede Gruppe mit mindestens einer Art (auch als zweite Gruppe)
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
      const sp = e.species;
      // Name (bzw. eigene Überschrift wie „Silberreiher und zwei Doppelgänger“) verlinkt den
      // Steckbrief (guide.js leitet alte Adressen …/#<art> darüber weiter)
      assert.ok(card.includes(`<h4 class="bird-name"><a href="arten/${e.id}/">${nameHtml(sp, sp.title || sp.name)}</a></h4>`), e.id);
      // Vorschaubild ist Beiwerk zum Namen: für Hilfsmittel verborgen, kein eigener Tab-Stopp,
      // Bilder ohne Alternativtext, Zeichnungen ohne Beschriftung
      const thumb = /<div class="thumb" aria-hidden="true">([\s\S]*?)<div class="bird-body">/.exec(card)?.[1];
      assert.ok(thumb?.includes('<div class="tslides" tabindex="-1">'), `${e.id}: Bildleiste`);
      assert.ok(thumb && /<svg |<img /.test(thumb), `${e.id}: Vorschaubild fehlt`);
      for (const img of thumb.match(/<img [^>]*>/g) || []) assert.match(img, /\salt=""/, `${e.id}: ${img}`);
      for (const svg of thumb.match(/<svg [^>]*>/g) || []) assert.match(svg, /\saria-hidden="true"/, `${e.id}: ${svg}`);
      // Bildleiste zum Wischen: Foto (falls vorhanden), Zeichnung, Illustration (falls vorhanden)
      const views = [...thumb.matchAll(/<figure class="tslide ([a-z-]+)" data-view="[A-Za-z]+"/g)].map((m) => m[1]);
      assert.deepEqual(views, [result.photos.has(sp) && 'photo', 'plate-view', result.illustrations.has(sp) && 'illus'].filter(Boolean), e.id);
      if (result.photos.has(sp)) {
        assert.equal(result.photos.get(sp), `photos/${kind.dir}/${sp.id}.jpg`, e.id);
        assert.ok(thumb.includes(`<img src="${upFrom(P)}photos/${kind.dir}/${sp.id}.jpg"`), e.id);
      }
      if (e.local) assert.ok(card.includes(`<span class="local">${esc(e.local)}</span>`), e.id);
      const size = sp.size && /^\s*(ca\.?\s*)?\d/.test(sp.size) ? sp.sizeLabel : sp.len ? kind.size.chip(sp.len) : sp.sizeLabel;
      if (size) assert.ok(card.includes(`<span>${esc(size)}</span>`), `${e.id}: Größe ${size}`);
    });
    // Die Hauptseite ist kompakt: keine Steckbrief-Inhalte
    assert.doesNotMatch(home, /<ol class="marks">|class="credit"|class="slides"/);
    if (region.lead) assert.ok(home.includes(`<h2 id="ueber">Über ${esc(region.name)}</h2>`));
  });

  test(`${R}: only species of its own animal type`, () => {
    const own = new Set(fs.readdirSync(path.join(ROOT, 'content', kind.dir)));
    const ids = cardTags.map((t) => attr(t, 'id'));
    assert.ok(ids.length);
    for (const id of ids) assert.ok(own.has(id), `${id} gehört nicht zu ${kind.label}`);
    for (const e of entries) assert.equal(e.species.kind, kind, e.id);
  });

  test(`${R}: every species has its own page with back link, texts of its animal type and pager`, () => {
    const dirs = fs.readdirSync(path.join(result.out, P, 'arten')).sort();
    assert.deepEqual(dirs, entries.map((e) => e.id).sort());
    order.forEach((e, i) => {
      const html = read(speciesPage(e.id));
      const sp = e.species;
      assert.ok(html.includes(`<h1>${nameHtml(sp, sp.title || sp.name)}</h1>`), e.id);
      assert.match(html, /<p class="back"><a href="\.\.\/\.\.\/" data-back>← Alle Arten<\/a><\/p>/, e.id);
      assert.match(html, /<article class="sp">/, e.id);
      assert.ok(html.includes(`<i>${esc(sp.scientific)}</i>`), e.id);
      if (e.status) assert.ok(html.includes(`<li>${esc(e.status)}</li>`), `${e.id}: status`);
      // Texte und Links der Tiergruppe (Verhalten, Raupenfutter …; xeno-canto bzw. iNaturalist)
      for (const [field, label] of kind.texts) {
        assert.equal(html.includes(`<h2 class="k">${esc(label)}</h2>`), !!sp[field], `${e.id}: ${field}`);
      }
      for (const l of kind.links(sp)) assert.ok(html.includes(l), `${e.id}: ${l}`);
      // Bilder: Foto im Ordner der Tiergruppe, mit Nachweis
      if (result.photos.has(sp)) assert.ok(html.includes(`<figure class="slide photo"><img src="${upFrom(`${P}arten/${e.id}/`)}photos/${kind.dir}/${sp.id}.jpg"`), e.id);
      if (sp.photo) assert.ok(html.includes('<p class="credit">Foto: '), e.id);
      // Blättern in der Reihenfolge der Liste
      const prev = /<a rel="prev" href="\.\.\/([^/]+)\/">/.exec(html)?.[1];
      const next = /<a rel="next" href="\.\.\/([^/]+)\/">/.exec(html)?.[1];
      assert.equal(prev, order[i - 1]?.id, `${e.id}: vorige Art`);
      assert.equal(next, order[i + 1]?.id, `${e.id}: nächste Art`);
      // Gute Orte: je Ort ein Link zur Beschreibung auf der Seite „Orte“
      const siteLinks = [...html.matchAll(/<a href="\.\.\/\.\.\/orte\/#([^"]+)">/g)].map((m) => m[1]);
      assert.deepEqual(siteLinks, has.orte ? (e.siteIdx || []).map((k) => region.sites[k].slug) : [], e.id);
      // Lebensräume als Kärtchen
      const habs = [...html.matchAll(/<li class="hab">([^<]+)<\/li>/g)].map((m) => unescape(m[1]));
      assert.deepEqual(habs, e.groups.map((id) => region.groups.find((g) => g.id === id).label), e.id);
      // Monatsleiste nur bei Arten, die nicht ganzjährig da sind
      assert.equal(/<h2 class="k">Wann hier<\/h2>/.test(html), !!(e.monthSet && e.monthSet.size < 12), e.id);
    });
  });

  test(`${R}: the finder asks for colours, size, habitat, site and month, and cards carry its data`, () => {
    assert.match(home, /<section class="finder" id="finder" aria-labelledby="finder-h" hidden>/);
    assert.ok(home.includes(`<h2 id="finder-h" tabindex="-1">${esc(kind.one)} gesehen?</h2>`));
    // Reihenfolge der Fragen
    const rows = [...home.matchAll(/<div class="opts (o-[a-z]+)[^"]*">/g)].map((m) => m[1]);
    assert.deepEqual(rows, ['o-colors', 'o-sizes', habitats.length ? 'o-habitats' : null, region.sites.length ? 'o-sites' : null, 'o-months'].filter(Boolean));
    assert.equal((home.match(/<button type="button" data-c="/g) || []).length, COLORS.length);
    // Größenklassen der Tiergruppe (Körperlänge bzw. Spannweite)
    const classes = kind.size.classes;
    assert.ok(home.includes(`<legend>${esc(kind.size.legend)}</legend><div class="opts o-sizes o-sizes-${classes.length}">`));
    const sizes = [...home.matchAll(/<button type="button" data-s="([a-z]+)" data-min="([\d.]+)" data-max="([\d.]+)"(?: data-say="([^"]*)")? aria-pressed="false">/g)];
    assert.deepEqual(
      sizes.map((m) => [m[1], Number(m[2]), Number(m[3]), m[4] === undefined ? undefined : unescape(m[4])]),
      classes.map((c) => [c.id, c.min, c.max, c.say]),
    );
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
      const sp = e.species;
      assert.equal(attr(tag, 'data-len'), sp.len?.join(' '), e.id);
      assert.equal(attr(tag, 'data-colors'), sp.colorIds?.length ? sp.colorIds.join(' ') : undefined, e.id);
      assert.equal(attr(tag, 'data-groups'), e.groups.length ? e.groups.join(' ') : undefined, e.id);
      assert.equal(attr(tag, 'data-sites'), region.sites.length ? (e.siteIdx || []).join(' ') : undefined, e.id);
      const partial = e.monthSet && e.monthSet.size < 12;
      assert.equal(attr(tag, 'data-months'), partial ? [...e.monthSet].sort((a, b) => a - b).join(' ') : undefined, e.id);
    });
    // Im echten Inhalt hat jede Art eine Größe und Farben
    for (const t of cardTags) assert.match(t, /data-len="[\d. ]+" data-colors="[a-z ]+"/, t);
    // „… gesehen?“ und die Artkarten gibt es nur auf der Hauptseite
    for (const rel of regionPages.filter((p) => p !== `${P}index.html`)) {
      assert.doesNotMatch(read(rel), /id="finder"|<article class="bird"/, rel);
    }
  });

  test(`${R}: the menu lists the subpages with content and marks the current one`, () => {
    for (const [key, dir] of Object.entries(SUBPAGES)) {
      assert.equal(fs.existsSync(path.join(result.out, P, dir, 'index.html')), has[key], dir);
    }
    const expected = ['find', ...Object.keys(SUBPAGES).filter((k) => has[k])];
    // Seiten der Region: Hauptseite, Steckbriefe und Unterseiten, sonst nichts
    assert.equal(regionPages.length, 1 + entries.length + expected.length - 1);
    for (const rel of regionPages) {
      const html = read(rel);
      const nav = navOf(html);
      assert.ok(nav, `${rel}: Menü fehlt`);
      assert.deepEqual(nav.map((n) => n.key), expected, rel);
      // Der erste Punkt heißt nach der Tiergruppe („Vogel gesehen?“, „Falter gesehen?“)
      assert.equal(nav[0].label, kind.findLabel, rel);
      assert.match(html, new RegExp(`<nav class="regnav" aria-label="${esc(region.name)}: [^"]+">`), rel);
      const sub = Object.keys(SUBPAGES).find((k) => rel === `${P}${SUBPAGES[k]}index.html`);
      const isSpecies = rel.startsWith(`${P}arten/`);
      // Steckbriefe gehören zu „… gesehen?“, sind aber nicht die Seite selbst
      assert.deepEqual(nav.filter((n) => n.on).map((n) => n.key), [sub || 'find'], rel);
      assert.deepEqual(nav.filter((n) => n.current === 'page').map((n) => n.key), isSpecies ? [] : [sub || 'find'], rel);
      for (const n of nav) {
        assert.equal(n.old, OLD_HASH[n.key], `${rel}: data-old von nav-${n.key}`);
        const t = target(rel, n.href);
        assert.equal(t.file, n.key === 'find' ? `${P}index.html` : `${P}${SUBPAGES[n.key]}index.html`, `${rel}: nav-${n.key}`);
      }
      // Marke in der Kopfleiste führt zur Hauptseite der Region, die Marke der Website zur Übersicht der Tiergruppe
      const brand = /<a href="([^"]*)" class="brand-region">/.exec(html)?.[1];
      assert.equal(target(rel, brand).file, `${P}index.html`, rel);
      const brandHome = /<a href="([^"]*)" class="brand-home">/.exec(html)?.[1];
      assert.equal(target(rel, brandHome).file, `${kind.path}index.html`, rel);
    }
    // Die Übersicht der Tiergruppe verlinkt die Region
    const index = `${kind.path}index.html`;
    assert.ok(
      [...read(index).matchAll(/<li class="region-card"><a href="([^"]+)"/g)].some((m) => target(index, m[1]).file === `${P}index.html`),
      `${index} verlinkt ${P} nicht`,
    );
  });

  test(`${R}: the animal type switch marks this type on every page and leads to the same region`, () => {
    for (const rel of regionPages) {
      const sw = kindsOf(read(rel));
      if (kinds.length < 2) {
        assert.equal(sw, null, rel);
        continue;
      }
      assert.ok(sw, `${rel}: Auswahl der Tiergruppe fehlt`);
      const current = sw.filter((s) => s.current);
      assert.equal(current.length, 1, rel);
      // Nur die Hauptseite ist die Seite selbst; Steckbriefe und Unterseiten gehören dazu
      assert.equal(current[0].current, rel === `${P}index.html` ? 'page' : 'true', rel);
      assert.equal(target(rel, current[0].href).file, `${P}index.html`, rel);
      assert.equal(current[0].count, entries.length, rel);
      // Die anderen Tiergruppen derselben Region (sonst ihre Übersicht)
      for (const other of kinds.filter((k) => k !== kind)) {
        const same = result.regions.find((r) => r.kind === other && r.id === region.id);
        const item = sw[kinds.indexOf(other)];
        assert.equal(target(rel, item.href).file, same ? `${same.path}index.html` : `${other.path}index.html`, `${rel}: ${other.label}`);
        if (same) assert.equal(item.count, same.entries.length, `${rel}: ${other.label}`);
      }
    }
  });

  test(`${R}: the places page links every site to the finder`, { skip: !region.sites.length }, () => {
    const html = read(`${P}orte/index.html`);
    const slugs = region.sites.map((s) => s.slug);
    assert.deepEqual([...html.matchAll(/<li class="site" id="([^"]+)">/g)].map((m) => m[1]), slugs);
    assert.deepEqual(
      [...html.matchAll(/<a class="site-find" href="([^"]+)">/g)].map((m) => unescape(m[1])),
      slugs.map((s) => `../?ort=${s}#finder`),
    );
    assert.equal((html.match(new RegExp(`</svg>Hier einen ${kind.one} gesehen\\?</a>`, 'g')) || []).length, slugs.length);
    // Die Ortsangabe ist auf der Hauptseite auswählbar
    for (const s of slugs) assert.ok(home.includes(` data-o="${s}" `), s);
    // Nummern auf der Karte führen zum Ort
    if (region.map) {
      const pins = [...html.matchAll(/<a href="#([^"]+)" class="pin" aria-label="([^"]+)">/g)].map((m) => [m[1], unescape(m[2])]);
      const want = region.sites.map((s, i) => (s.pin ? [s.slug, `${i + 1}: ${s.name}`] : null)).filter(Boolean);
      assert.deepEqual(pins, want);
    }
    // Arten des Ortes (Liste unter dem Schlüssel der Tiergruppe) verlinken ihre Steckbriefe
    for (const s of region.sites) {
      const list = s[kind.key] || [];
      for (const id of list) assert.ok(html.includes(`<a href="../arten/${id}/">`), `${s.name}: ${id}`);
    }
    if (region.sites.some((s) => s[kind.key]?.length)) assert.ok(html.includes(`<ul class="site-birds" aria-label="${esc(kind.siteSpecies)}">`));
  });

  test(`${R}: nothing of the old single page is left`, () => {
    for (const rel of regionPages) {
      const html = read(rel);
      assert.doesNotMatch(html, /class="filters"|data-g=|<details class="finder"|class="finder-q"/, rel);
    }
  });
}

test('the Silberreiher card shows its own heading and size, not the wider search length', () => {
  const html = fs.readFileSync(path.join(result.out, 'ometepe', 'index.html'), 'utf8');
  const card = /<article class="bird" id="silberreiher"[\s\S]*?<\/article>/.exec(html)?.[0] || '';
  assert.match(card, /<h4 class="bird-name"><a href="arten\/silberreiher\/">Silberreiher und zwei Doppelgänger<\/a><\/h4>/);
  assert.match(card, /<span>80–104 cm<\/span>/);
  // Die Suche rechnet weiter mit der Länge der Doppelgänger (ab 46 cm)
  assert.match(card, /data-len="46 104"/);
});
