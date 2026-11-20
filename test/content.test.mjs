import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent, commonsFileName, commonsPageUrl, licenseUrl } from '../scripts/lib/content.mjs';
import { build } from '../scripts/build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/** Legt ein Mini-Projekt in einem temporären Ordner an. */
function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-'));
  const all = {
    'content/site.yml': 'title: Test\n',
    'content/birds/fischadler/bird.yml': 'name: Fischadler\nenglish: Osprey\nscientific: Pandion haliaetus\nmarks: [A]\n',
    'content/regions/see/region.yml': 'name: See\ntitle: Vögel am See\ngroups:\n  - id: wasser\n    label: Wasser\nbirds:\n  - id: fischadler\n    group: wasser\n',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    if (text === null) continue;
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  fs.cpSync(path.join(ROOT, 'assets'), path.join(dir, 'assets'), { recursive: true });
  return dir;
}

const messages = (list) => list.map((e) => `${e.path}: ${e.message}`).join('\n');

test('minimal content loads without errors', () => {
  const r = loadContent(fixture({}));
  assert.equal(r.errors.length, 0, messages(r.errors));
  assert.equal(r.regions.length, 1);
  assert.equal(r.regions[0].entries[0].bird.name, 'Fischadler');
});

test('typo in a field name is reported with a suggestion', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nbehaviour: Jagt\n' }));
  assert.match(messages(r.errors), /behaviour.*Meintest du „behavior“/);
});

test('unknown bird id in a region is reported with a suggestion', () => {
  const r = loadContent(fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadlr\n' }));
  assert.match(messages(r.errors), /birds\[0\]\.id.*Meintest du „fischadler“/);
});

test('unknown group is reported', () => {
  const r = loadContent(fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\ngroups:\n  - id: wasser\n    label: W\nbirds:\n  - id: fischadler\n    group: wassr\n' }));
  assert.match(messages(r.errors), /Gruppe „wassr“.*Meintest du „wasser“/);
});

const TWO_GROUPS = 'groups:\n  - id: wasser\n    label: Wasser\n  - id: himmel\n    label: Am Himmel\n';

test('a species can belong to several groups; the first one is the main group', () => {
  const r = loadContent(fixture({
    'content/regions/see/region.yml': `name: See\ntitle: T\n${TWO_GROUPS}birds:\n  - id: fischadler\n    group: [himmel, wasser, himmel]\n`,
  }));
  assert.equal(r.errors.length, 0, messages(r.errors));
  // „wasser“ ist nur zweite Gruppe, hat aber trotzdem eine Art
  assert.doesNotMatch(messages(r.warnings), /keine Arten/);
  const entry = r.regions[0].entries[0];
  assert.equal(entry.group, 'himmel');
  assert.deepEqual(entry.groups, ['himmel', 'wasser'], 'doppelte Angaben zählen einmal');
  // Eine einzelne id ergibt eine Liste mit einem Eintrag
  const single = loadContent(fixture({})).regions[0].entries[0];
  assert.equal(single.group, 'wasser');
  assert.deepEqual(single.groups, ['wasser']);
});

test('group lists are checked item by item', () => {
  const region = (group) => `name: See\ntitle: T\n${TWO_GROUPS}birds:\n  - id: fischadler\n    group: ${group}\n`;
  // Tippfehler in einer Liste: Stelle mit Index und Vorschlag
  const typo = loadContent(fixture({ 'content/regions/see/region.yml': region('[wasser, himml]') }));
  const e = typo.errors.find((x) => x.path === 'birds[0].group[1]');
  assert.ok(e, messages(typo.errors));
  assert.match(e.message, /Gruppe „himml“ ist oben unter groups nicht definiert\. Meintest du „himmel“/);
  assert.deepEqual(typo.regions[0].entries[0].groups, ['wasser'], 'der gültige Teil bleibt');
  // Kein Text (z. B. ein Block mit Unterfeldern) ist ein Fehler, einzeln und in der Liste
  const block = loadContent(fixture({ 'content/regions/see/region.yml': region('\n      id: wasser') }));
  assert.match(messages(block.errors), /birds\[0\]\.group: .*group braucht die id einer Gruppe/);
  const nested = loadContent(fixture({ 'content/regions/see/region.yml': region('[wasser, [himmel]]') }));
  assert.match(messages(nested.errors), /birds\[0\]\.group\[1\]: .*group braucht die id einer Gruppe/);
  // Eine leere Liste heißt: Gruppe fehlt
  const empty = loadContent(fixture({ 'content/regions/see/region.yml': region('[]') }));
  assert.match(messages(empty.errors), /birds\[0\]\.id: .*Gruppe fehlt/);
});

test('groups on a species are ignored with a hint when the region has none', () => {
  const r = loadContent(fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\n    group: [himmel, wasser]\n' }));
  assert.equal(r.errors.length, 0, messages(r.errors));
  const w = r.warnings.find((x) => x.path === 'birds[0].group');
  assert.ok(w, messages(r.warnings));
  assert.match(w.message, /die Region hat keine groups; die Angabe wird ignoriert/);
  const entry = r.regions[0].entries[0];
  assert.equal(entry.group, undefined);
  assert.deepEqual(entry.groups, []);
});

test('fields that are no longer used are reported as unknown', () => {
  const site = loadContent(fixture({ 'content/site.yml': 'title: Test\nspecies_intro: A\nphoto_hint_linked: B\nphoto_hint_shown: C\n' }));
  const m = messages(site.errors);
  for (const key of ['species_intro', 'photo_hint_linked', 'photo_hint_shown']) assert.match(m, new RegExp(`${key}: Unbekanntes Feld „${key}“`));
  const region = loadContent(fixture({
    'content/regions/see/region.yml': 'name: See\ntitle: T\nspecies_intro: A\ngroups:\n  - id: wasser\n    label: W\nbirds:\n  - id: fischadler\n    group: wasser\n',
  }));
  assert.match(messages(region.errors), /species_intro: Unbekanntes Feld „species_intro“/);
});

test('site birds must belong to the region', () => {
  const r = loadContent(fixture({
    'content/birds/kolibri/bird.yml': 'name: Kolibri\nscientific: Amazilia rutila\n',
    'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\nplaces:\n  sites:\n    - name: Ufer\n      birds: [kolibri]\n',
  }));
  assert.match(messages(r.errors), /places\.sites\[0\]\.birds\[0\].*keine Art dieser Region/);
});

test('YAML syntax errors point to the line', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nbehavior: Jagt: über dem See\n' }));
  assert.equal(r.errors.length, 1, messages(r.errors));
  assert.equal(r.errors[0].line, 3);
  assert.match(r.errors[0].message, /Anführungszeichen/);
});

test('missing required fields and bad values are reported', () => {
  const r = loadContent(fixture({
    'content/birds/fischadler/bird.yml': 'name: Fischadler\niucn: XX\nmarks: Nur ein Text\n',
  }));
  const m = messages(r.errors);
  assert.match(m, /scientific: Pflichtfeld/);
  assert.match(m, /iucn: „XX“ ist nicht erlaubt/);
});

test('a single string is accepted where a list is expected', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nmarks: Nur ein Merkmal\n' }));
  assert.equal(r.errors.length, 0, messages(r.errors));
  assert.deepEqual(r.birds.get('fischadler').marks, ['Nur ein Merkmal']);
});

test('invalid folder names are rejected', () => {
  const r = loadContent(fixture({ 'content/birds/Grünreiher/bird.yml': 'name: Grünreiher\nscientific: Butorides virescens\n' }));
  assert.match(messages(r.errors), /Ordnername „Grünreiher“ ist ungültig/);
});

test('errors in draft regions do not block a normal build', () => {
  const dir = fixture({ 'content/regions/neu/region.yml': 'draft: true\nname: Neu\ntitle: Neu\nbirds:\n  - id: gibtsnicht\n' });
  const normal = loadContent(dir);
  assert.equal(normal.errors.length, 0, messages(normal.errors));
  assert.match(messages(normal.warnings), /Entwurf/);
  assert.equal(normal.regions.length, 1);
  const withDrafts = loadContent(dir, { drafts: true });
  assert.match(messages(withDrafts.errors), /gibtsnicht/);
});

test('a freshly scaffolded empty draft region is only a warning, also in the preview', () => {
  const dir = fixture({ 'content/regions/neu/region.yml': 'draft: true\nname: Neu\ntitle: Neu\nbirds: []\n' });
  const r = loadContent(dir, { drafts: true });
  assert.equal(r.errors.length, 0, messages(r.errors));
  assert.match(messages(r.warnings), /mindestens eine Art/);
});

test('errors in a species used only by draft regions do not block a normal build', () => {
  const dir = fixture({
    'content/birds/neu/bird.yml': 'name: Neu\nscientific: Novus avis\nbehaviour: Tippfehler\n',
    'content/regions/entwurf/region.yml': 'draft: true\nname: E\ntitle: E\nbirds:\n  - id: neu\n',
  });
  const normal = loadContent(dir);
  assert.equal(normal.errors.length, 0, messages(normal.errors));
  assert.match(messages(normal.warnings), /Entwurf.*behaviour/);
  assert.match(messages(loadContent(dir, { drafts: true }).errors), /behaviour/);
  // Sobald eine veröffentlichte Region die Art nutzt, ist es wieder ein Fehler
  const published = fixture({
    'content/birds/neu/bird.yml': 'name: Neu\nscientific: Novus avis\nbehaviour: Tippfehler\n',
    'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: neu\n',
  });
  assert.match(messages(loadContent(published).errors), /behaviour/);
});

test('a broken species file causes no follow-up errors in regions', () => {
  const r = loadContent(fixture({
    'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: [kaputt\n',
    'content/regions/see/region.yml': 'name: See\ntitle: T\ngroups:\n  - id: wasser\n    label: W\nbirds:\n  - id: fischadler\n    group: wasser\nplaces:\n  sites:\n    - name: Ufer\n      birds: [fischadler]\n',
  }));
  assert.equal(r.errors.length, 1, messages(r.errors));
  assert.equal(r.errors[0].file, 'content/birds/fischadler/bird.yml');
  assert.doesNotMatch(messages(r.warnings), /keine Arten|keiner Region/);
});

test('numbers in text fields are kept exactly as written', () => {
  const r = loadContent(fixture({
    'content/regions/see/region.yml': 'name: See\ntitle: T\nfacts:\n  - value: 2.500\n    label: Paare\n  - value: 0043\n    label: Vorwahl\nbirds:\n  - id: fischadler\n    status: 1.0\n',
  }));
  assert.equal(r.errors.length, 0, messages(r.errors));
  assert.deepEqual(r.regions[0].facts.map((f) => f.value), ['2.500', '0043']);
  assert.equal(r.regions[0].entries[0].status, '1.0');
});

test('placeholders work in all region texts', () => {
  const r = loadContent(fixture({
    'content/regions/see/region.yml': 'name: See\ntitle: "{arten} Arten am See"\neyebrow: "{orte} Orte"\nbirds:\n  - id: fischadler\n    text: Eine von {arten}\nplaces:\n  sites:\n    - name: A\n      text: Ort 1 von {orte}\n',
  }));
  assert.equal(r.errors.length, 0, messages(r.errors));
  const reg = r.regions[0];
  assert.equal(reg.title, '1 Arten am See');
  assert.equal(reg.eyebrow, '1 Orte');
  assert.equal(reg.entries[0].text, 'Eine von 1');
  assert.equal(reg.sites[0].text, 'Ort 1 von 1');
});

test('messages carry line numbers and a hint for unquoted colons', () => {
  const r = loadContent(fixture({
    'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nmarks:\n  - Erster Punkt\n  - Achtung: zweiter Punkt\n',
  }));
  const e = r.errors.find((x) => x.path === 'marks[1]');
  assert.ok(e, messages(r.errors));
  assert.equal(e.line, 5);
  assert.match(e.message, /in Anführungszeichen.*"Achtung: zweiter Punkt"/);
});

test('template texts must be replaced before publishing', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nmarks: [Erstes Merkmal]\n' }));
  assert.match(messages(r.errors), /Vorlagentext noch nicht ersetzt: „Erstes Merkmal“/);
});

test('urls must be absolute web addresses', () => {
  const r = loadContent(fixture({
    'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\nsources:\n  list:\n    - title: A\n      url: www.example.org\n    - title: B\n      url: javascript:alert(1)\n',
  }));
  assert.equal(r.errors.filter((e) => /keine gültige Adresse/.test(e.message)).length, 2, messages(r.errors));
});

test('a text cut off by an unquoted " #" is reported', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nsize: Platz #1 der Größten\n' }));
  assert.match(messages(r.warnings), /Text endet vor „ #1/);
});

test('unknown keys that look like object properties are reported', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nconstructor: x\n' }));
  assert.match(messages(r.errors), /Unbekanntes Feld „constructor“/);
});

test('season months are validated', () => {
  const r = loadContent(fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\nseason:\n  rows:\n    - label: X\n      months: 0-3\n' }));
  assert.match(messages(r.errors), /season\.rows\[0\]\.months/);
});

test('Commons helpers normalise file names and licences', () => {
  assert.equal(commonsFileName('https://commons.wikimedia.org/wiki/File:Great_Egret_(Ardea_alba)_RWD.jpg'), 'Great Egret (Ardea alba) RWD.jpg');
  assert.equal(commonsFileName('Datei:Foo_bar.jpg'), 'Foo bar.jpg');
  assert.equal(
    commonsPageUrl('003 Ringed kingfisher flying with a fish in Encontro das Águas State Park Photo by Giles Laurent.jpg'),
    'https://commons.wikimedia.org/wiki/File:003_Ringed_kingfisher_flying_with_a_fish_in_Encontro_das_%C3%81guas_State_Park_Photo_by_Giles_Laurent.jpg',
  );
  assert.equal(commonsPageUrl('Eupsittula canicularis, Guacalillo, Costa Rica 1.jpg'), 'https://commons.wikimedia.org/wiki/File:Eupsittula_canicularis,_Guacalillo,_Costa_Rica_1.jpg');
  assert.equal(licenseUrl('CC BY-SA 4.0'), 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(licenseUrl('CC BY 2.0'), 'https://creativecommons.org/licenses/by/2.0/');
  assert.equal(licenseUrl('CC0'), 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(licenseUrl('Eigene Lizenz'), null);
});

test('build writes pages for a fixture and refuses to wipe a project folder', () => {
  const dir = fixture({});
  const out = path.join(dir, '_site');
  const r = build({ root: dir, out });
  assert.ok(r.ok, messages(r.errors));
  assert.ok(fs.existsSync(path.join(out, 'see', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
  assert.throws(() => build({ root: dir, out: dir }), /Projekt oder ein übergeordneter Ordner/);
  assert.throws(() => build({ root: dir, out: path.dirname(dir) }), /Projekt oder ein übergeordneter Ordner/);
  assert.throws(() => build({ root: dir, out: path.join(dir, 'assets') }), /nicht leer/);
  assert.ok(fs.existsSync(path.join(dir, 'assets', 'style.css')));
  // ein früherer Build darf überschrieben werden
  assert.ok(build({ root: dir, out }).ok);
  // auch ein abgebrochener Build im Standardordner _site blockiert nicht
  fs.rmSync(path.join(out, '.nojekyll'));
  assert.ok(build({ root: dir, out }).ok);
});

/** Liest eine erzeugte Seite; `rel` relativ zum Ausgabeordner. */
const page = (out, rel) => fs.readFileSync(path.join(out, rel), 'utf8');
/** Menüpunkte einer Seite (nav-find, nav-orte …) in Reihenfolge. */
const navKeys = (html) => [...html.matchAll(/<a href="[^"]*" class="nav-([a-z]+)/g)].map((m) => m[1]);

test('subpages without content are left out, also in the menu', () => {
  // Minimal: nur Hauptseite, Steckbrief und Quellen
  const dir = fixture({});
  const out = path.join(dir, '_site');
  assert.ok(build({ root: dir, out }).ok);
  for (const rel of ['see/index.html', 'see/arten/fischadler/index.html', 'see/quellen/index.html']) {
    assert.ok(fs.existsSync(path.join(out, rel)), rel);
    assert.deepEqual(navKeys(page(out, rel)), ['find', 'sources'], rel);
  }
  for (const sub of ['orte', 'wann-und-wie', 'weitere-arten']) assert.ok(!fs.existsSync(path.join(out, 'see', sub)), sub);
  assert.doesNotMatch(page(out, 'see/arten/fischadler/index.html'), /Gute Orte/);

  // Mit Orten (ohne Karte), Tipps und weiteren Arten gibt es alle Unterseiten
  const full = fixture({
    'content/regions/see/region.yml':
      'name: See\ntitle: T\ngroups:\n  - id: wasser\n    label: W\nbirds:\n  - id: fischadler\n    group: wasser\n' +
      'places:\n  sites:\n    - name: Ufer\n      birds: [fischadler]\n' +
      'tips:\n  items:\n    - text: Früh aufstehen\n' +
      'more:\n  groups:\n    - title: Enten\n      species:\n        - name: Stockente\n',
  });
  const fullOut = path.join(full, '_site');
  assert.ok(build({ root: full, out: fullOut }).ok);
  for (const sub of ['orte', 'wann-und-wie', 'weitere-arten', 'quellen']) assert.ok(fs.existsSync(path.join(fullOut, 'see', sub, 'index.html')), sub);
  assert.deepEqual(navKeys(page(fullOut, 'see/index.html')), ['find', 'orte', 'season', 'more', 'sources']);
  const places = page(fullOut, 'see/orte/index.html');
  assert.match(places, /<div class="places no-map">/);
  assert.match(places, /<li class="site" id="ufer">/);
  assert.match(places, /<a class="site-find" href="\.\.\/\?ort=ufer#finder">/);
  assert.match(page(fullOut, 'see/arten/fischadler/index.html'), /<h2 class="k">Gute Orte<\/h2><ul class="site-links"><li><a href="\.\.\/\.\.\/orte\/#ufer">/);
  assert.match(page(fullOut, 'see/wann-und-wie/index.html'), /Früh aufstehen/);
  assert.match(page(fullOut, 'see/weitere-arten/index.html'), /<strong>Stockente<\/strong>/);
});

test('habitats: the finder offers every group with species, the list is headed by main groups', () => {
  // „wasser“ ist nur zweite Gruppe des Fischadlers, „nacht“ hat gar keine Art
  const dir = fixture({
    'content/birds/reiher/bird.yml': 'name: Reiher\nenglish: Heron\nscientific: Ardea alba\nmarks: [A]\n',
    'content/regions/see/region.yml':
      'name: See\ntitle: T\ngroups:\n  - id: wald\n    label: Wald\n  - id: wasser\n    label: Wasser\n  - id: himmel\n    label: Am Himmel\n  - id: nacht\n    label: Nachts\n' +
      'birds:\n  - id: fischadler\n    group: [himmel, wasser]\n  - id: reiher\n    group: wald\n',
  });
  const out = path.join(dir, '_site');
  const r = build({ root: dir, out });
  assert.ok(r.ok, messages(r.errors));
  assert.match(messages(r.warnings), /Gruppe „nacht“ hat keine Arten/);
  assert.doesNotMatch(messages(r.warnings), /Gruppe „wasser“/);
  const home = page(out, 'see/index.html');
  // Auswahl „Lebensraum“ zwischen Größe und Ort: jede Gruppe mit einer Art, auch als zweite Gruppe
  assert.match(home, /<fieldset class="frow"><legend>Lebensraum<\/legend><div class="opts o-habitats">/);
  assert.deepEqual([...home.matchAll(/data-l="([^"]+)"/g)].map((m) => m[1]), ['wald', 'wasser', 'himmel']);
  // Überschriften in der Reihenfolge der groups, je Art nur unter ihrer Hauptgruppe
  assert.deepEqual([...home.matchAll(/<h3 class="tier grp">([^<]+) <span>(\d+) Arte?n?<\/span>/g)].map((m) => `${m[1]} ${m[2]}`), ['Wald 1', 'Am Himmel 1']);
  assert.deepEqual([...home.matchAll(/<article class="bird" id="([^"]+)"/g)].map((m) => m[1]), ['reiher', 'fischadler']);
  assert.match(home, /<article class="bird" id="fischadler"[^>]* data-groups="himmel wasser"/);
  assert.match(home, /<article class="bird" id="reiher"[^>]* data-groups="wald"/);
  // Keine Spur des früheren Filters
  assert.doesNotMatch(home, /class="filters"|data-g=/);
  // Steckbrief: alle Lebensräume als Kärtchen, Blättern in der Reihenfolge der Liste
  const sp = page(out, 'see/arten/fischadler/index.html');
  assert.match(sp, /<li class="hab">Am Himmel<\/li><li class="hab">Wasser<\/li><\/ul>/);
  assert.match(sp, /<a rel="prev" href="\.\.\/reiher\/">/);
  assert.doesNotMatch(sp, /rel="next"/);
});

test('a region without groups has no habitat question', () => {
  const dir = fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\n' });
  const out = path.join(dir, '_site');
  assert.ok(build({ root: dir, out }).ok);
  const home = page(out, 'see/index.html');
  assert.match(home, /<section class="finder" id="finder"/);
  assert.doesNotMatch(home, /o-habitats|data-l=|data-groups=/);
  assert.match(home, /<h3 class="tier grp">Alle Arten <span>1 Art<\/span><\/h3>/);
  assert.doesNotMatch(page(out, 'see/arten/fischadler/index.html'), /class="hab"/);
});

test('a tab in the indentation gets the tab hint', () => {
  const r = loadContent(fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nbehavior: >-\n\tJagt über dem See.\n' }));
  assert.equal(r.errors.length, 1, messages(r.errors));
  assert.match(r.errors[0].message, /Tabulator/);
  assert.doesNotMatch(r.errors[0].message, /at line/);
});

test('a photo downloaded for a Commons file is not shown after switching to a url photo', () => {
  const dir = fixture({
    'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nphoto:\n  url: https://example.com/foto\n  source: Flickr\n  author: A\n  license: CC BY 2.0\n',
    'content/birds/fischadler/photo.jpg': 'x',
    'content/birds/fischadler/.photo-source': 'Old.jpg\n',
  });
  const r = loadContent(dir);
  assert.equal(r.birds.get('fischadler').photo.local, null);
  assert.match(messages(r.warnings), /stammt von Commons/);
});

test('length, colours, months and near are validated', () => {
  const r = loadContent(fixture({
    'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nlength: Spannweite 150\ncolors: [braun, weis, lila]\n',
    'content/regions/see/region.yml':
      'name: See\ntitle: T\nbirds:\n  - id: fischadler\n    months: 13\nplaces:\n  sites:\n    - name: Ufer\n      near: [Ufr]\n    - name: Wald\n      near: [Wald]\n',
  }));
  const m = messages(r.errors);
  assert.match(m, /length: „Spannweite 150“ ist keine Länge/);
  assert.match(m, /colors\[1\]: „weis“ ist keine der Farben\. Meintest du „weiß“/);
  assert.match(m, /colors\[2\]: „lila“ ist keine der Farben/);
  assert.match(m, /birds\[0\]\.months: „13“ ist kein Monat/);
  assert.match(m, /places\.sites\[0\]\.near\[0\]: „Ufr“ ist kein Ort dieser Region.*Meintest du „Ufer“/);
  assert.match(m, /places\.sites\[1\]\.near\[0\]: Ein Ort kann nicht an sich selbst angrenzen/);
});

test('missing length and colours are hints, and the size chip falls back to the length', () => {
  const bare = loadContent(fixture({}));
  assert.match(messages(bare.warnings), /length: Körperlänge fehlt/);
  assert.match(messages(bare.warnings), /colors: Farben fehlen/);
  const dir = fixture({ 'content/birds/fischadler/bird.yml': 'name: Fischadler\nenglish: Osprey\nscientific: Pandion haliaetus\nmarks: [A]\nlength: 52-60\ncolors: [Braun, weiss]\n' });
  const r = loadContent(dir);
  assert.doesNotMatch(messages(r.warnings), /length|colors/);
  const bird = r.birds.get('fischadler');
  assert.deepEqual(bird.len, [52, 60]);
  assert.deepEqual(bird.colorIds, ['braun', 'weiss']);
  const out = path.join(dir, '_site');
  assert.ok(build({ root: dir, out }).ok);
  // Steckbrief: Größe als erstes Kärtchen
  const html = fs.readFileSync(path.join(out, 'see', 'arten', 'fischadler', 'index.html'), 'utf8');
  assert.match(html, /<ul class="chips"><li>52–60 cm<\/li>/);
  // Hauptseite: Größe in der kompakten Karte, Daten für „Vogel gesehen?“
  const home = fs.readFileSync(path.join(out, 'see', 'index.html'), 'utf8');
  assert.match(home, /data-len="52 60" data-colors="braun weiss"/);
  assert.match(home, /<p class="bird-sub"><span>52–60 cm<\/span><\/p>/);
});

const SVG = '<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10" onclick="x()"/></svg>';
const ILLUSTRATION = 'illustration:\n  file: Osprey drawing.svg\n  author: Jane Doe\n  license: CC BY-SA 4.0\n';

test('illustrations need licence details and are copied cleaned', () => {
  const base = 'name: Fischadler\nenglish: Osprey\nscientific: Pandion haliaetus\nmarks: [A]\nlength: 55\ncolors: [braun]\n';
  // Datei ohne Angaben
  const orphan = loadContent(fixture({ 'content/birds/fischadler/illustration.svg': SVG }));
  assert.match(messages(orphan.warnings), /illustration: Es liegt eine illustration\.svg im Ordner, aber ohne Angaben/);
  // Angaben ohne Datei
  const missing = loadContent(fixture({ 'content/birds/fischadler/bird.yml': base + ILLUSTRATION }));
  assert.match(messages(missing.warnings), /illustration\.svg fehlt noch.*npm run grafiken -- fischadler/);
  // Keine CC-Lizenz
  const nc = loadContent(fixture({ 'content/birds/fischadler/bird.yml': base + ILLUSTRATION.replace('CC BY-SA 4.0', 'Alle Rechte vorbehalten'), 'content/birds/fischadler/illustration.svg': SVG }));
  assert.match(messages(nc.warnings), /keine Creative-Commons-Lizenz/);
  // CC0 und gemeinfrei sind erlaubt (so stehen sie auf Commons)
  for (const license of ['CC0', 'Public domain']) {
    const free = loadContent(fixture({ 'content/birds/fischadler/bird.yml': base + ILLUSTRATION.replace('CC BY-SA 4.0', license), 'content/birds/fischadler/illustration.svg': SVG }));
    assert.doesNotMatch(messages(free.warnings), /keine Creative-Commons-Lizenz|unbekannt/, license);
  }

  const dir = fixture({ 'content/birds/fischadler/bird.yml': base + ILLUSTRATION, 'content/birds/fischadler/illustration.svg': SVG });
  const out = path.join(dir, '_site');
  const r = build({ root: dir, out });
  assert.ok(r.ok, messages(r.errors));
  assert.match(messages(r.warnings), /Skripte.*entfernt/);
  const copied = fs.readFileSync(path.join(out, 'illustrations', 'fischadler.svg'), 'utf8');
  assert.doesNotMatch(copied, /<script|onclick/);
  assert.match(copied, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  // Steckbrief (drei Ebenen unter der Wurzel): Illustration mit Nachweis direkt darunter
  const html = fs.readFileSync(path.join(out, 'see', 'arten', 'fischadler', 'index.html'), 'utf8');
  assert.match(html, /<figure class="slide illus"><img src="\.\.\/\.\.\/\.\.\/illustrations\/fischadler\.svg\?v=[0-9a-f]{10}" alt="Illustration: Fischadler"/);
  assert.match(html, /<p class="credit">Illustration: <a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Osprey_drawing\.svg" rel="noopener">Fischadler<\/a> · Jane Doe · <a href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/"/);
  // Zeichnung fehlt hier: Dann ist die Illustration die erste Ansicht, ohne Platzhalter und ohne Umschalter
  assert.doesNotMatch(html, /Zeichnung folgt/);
  assert.doesNotMatch(html, /class="tabs"/);
  // Bildnachweise stehen auf der Seite „Quellen“, mit Link zurück zum Steckbrief
  const sources = fs.readFileSync(path.join(out, 'see', 'quellen', 'index.html'), 'utf8');
  assert.match(sources, /<li>Illustration: <a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Osprey_drawing\.svg"[^\n]*<span class="for">\(<a href="\.\.\/arten\/fischadler\/"/);
  assert.match(sources, /Die Illustration \(SVG\) liegt im Repository/);

  // Gehört die Datei laut Merkdatei zu einer anderen Commons-Datei, wird sie nicht gezeigt
  fs.writeFileSync(path.join(dir, 'content/birds/fischadler/.illustration-source'), 'Other.svg\n');
  const stale = loadContent(dir);
  assert.equal(stale.birds.get('fischadler').illustration.local, null);
  assert.match(messages(stale.warnings), /Die gespeicherte Grafik stammt von „Other\.svg“/);
});

test('a species used only by a broken draft region does not block the build', () => {
  const r = loadContent(fixture({
    'content/birds/neu/bird.yml': 'name: Neu\nenglish: New\n',
    'content/regions/entwurf/region.yml': 'draft: true\nname: E\ntitle: E\nbirds:\n  - id: neu\nplaces:\n  sites:\n    - name: X\n      tagline: Schilf: Lacken\n',
  }));
  assert.equal(r.errors.length, 0, messages(r.errors));
  assert.match(messages(r.warnings), /scientific: \(Entwurf/);
});

test('a photo without source marker is not shown for a Commons file', () => {
  const r = loadContent(fixture({
    'content/birds/fischadler/bird.yml': 'name: Fischadler\nscientific: Pandion haliaetus\nphoto:\n  file: Osprey.jpg\n  author: A\n  license: CC BY 2.0\n',
    'content/birds/fischadler/photo.jpg': 'x',
  }));
  const p = r.birds.get('fischadler').photo;
  assert.equal(p.local, null);
  assert.equal(p.stale, true);
  assert.match(messages(r.warnings), /Herkunftsvermerk/);
});
