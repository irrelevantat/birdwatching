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
  assert.equal(r.regions[0].entries[0].species.name, 'Fischadler');
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
  const html = fs.readFileSync(path.join(out, 'see', 'index.html'), 'utf8');
  assert.match(html, /<ul class="chips"><li>52–60 cm<\/li>/);
  assert.match(html, /data-len="52 60" data-colors="braun weiss"/);
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
  const copied = fs.readFileSync(path.join(out, 'illustrations', 'birds', 'fischadler.svg'), 'utf8');
  assert.doesNotMatch(copied, /<script|onclick/);
  assert.match(copied, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  const html = fs.readFileSync(path.join(out, 'see', 'index.html'), 'utf8');
  assert.match(html, /<figure class="slide illus"><img src="\.\.\/illustrations\/birds\/fischadler\.svg\?v=[0-9a-f]{10}" alt="Illustration: Fischadler"/);
  assert.match(html, /<p class="credit">Illustration: <a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Osprey_drawing\.svg" rel="noopener">Fischadler<\/a> · Jane Doe · <a href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/"/);
  assert.match(html, /<li>Illustration: <a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Osprey_drawing\.svg"/);
  // Zeichnung fehlt hier: Dann ist die Illustration die erste Ansicht, ohne Platzhalter und ohne Umschalter
  assert.doesNotMatch(html, /Zeichnung folgt/);
  assert.doesNotMatch(html, /class="tabs"/);

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

// ---------------------------------------------------------------------------
// Tiergruppen (Vögel, Schmetterlinge)

const FALTER = 'name: Julia-Falter\nenglish: Julia Heliconian\nscientific: Dryas iulia\nwingspan: 8,2-9,2\ncolors: [orange, schwarz]\nmarks: [A]\nfoodplants: Passionsblumen\n';
const FALTER_REGION = 'name: See\ntitle: Falter am See\nbutterflies:\n  - id: dryas-iulia\n    status: 4 Funde\nplaces:\n  sites:\n    - name: Ufer\n      butterflies: [dryas-iulia]\n';

test('butterflies load from their own folder and region file', () => {
  const dir = fixture({ 'content/butterflies/dryas-iulia/butterfly.yml': FALTER, 'content/regions/see/butterflies.yml': FALTER_REGION });
  const r = loadContent(dir);
  assert.equal(r.errors.length, 0, messages(r.errors));
  assert.deepEqual(r.regions.map((g) => `${g.kind.id}:${g.path}`), ['voegel:see/', 'schmetterlinge:schmetterlinge/see/']);
  const sp = r.species.get('schmetterlinge').get('dryas-iulia');
  assert.deepEqual(sp.len, [8.2, 9.2]);
  assert.equal(sp.sizeLabel, 'Spannweite 8,2–9,2 cm');
  assert.equal(r.regions[1].entries[0].siteIdx[0], 0);

  const out = path.join(dir, '_site');
  assert.ok(build({ root: dir, out }).ok);
  const html = fs.readFileSync(path.join(out, 'schmetterlinge', 'see', 'index.html'), 'utf8');
  assert.match(html, /<ul class="chips"><li>Spannweite 8,2–9,2 cm<\/li><li>4 Funde<\/li>/);
  assert.match(html, /<span class="k">Raupenfutter<\/span>Passionsblumen/);
  assert.match(html, /Schmetterling gesehen\?/);
  assert.match(html, /data-s="handteller" data-min="8" data-max="11" data-say="handtellergroß"/);
  assert.match(html, /inaturalist\.org\/taxa\/search\?q=Dryas\+iulia/);
  assert.doesNotMatch(html, /xeno-canto|Fischadler/);
  // Übersicht der Schmetterlinge und Auswahl oben
  const index = fs.readFileSync(path.join(out, 'schmetterlinge', 'index.html'), 'utf8');
  assert.match(index, /<h1>Schmetterlingsführer<\/h1>/);
  assert.match(index, /<a href="\.\.\/">Vögel <b>1<\/b><\/a>/);
  assert.match(index, /<a href="\.\.\/schmetterlinge\/" aria-current="page">Schmetterlinge <b>1<\/b><\/a>/);
  assert.doesNotMatch(index, /href="\.\.\/see\/"/);
  const birds = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(birds, /<h1>Vogelführer<\/h1>/);
  assert.match(birds, /<li class="region-card"><a href="see\/">/);
  assert.doesNotMatch(birds, /region-card"><a href="schmetterlinge/);
});

test('a region file may not use species of another animal type', () => {
  const r = loadContent(fixture({
    'content/butterflies/dryas-iulia/butterfly.yml': FALTER,
    'content/regions/see/butterflies.yml': 'name: See\ntitle: T\nbutterflies:\n  - id: fischadler\n',
  }));
  assert.match(messages(r.errors), /butterflies\[0\]\.id: Art „fischadler“ gibt es nicht unter content\/butterflies\/\. Sie liegt unter content\/birds\/ \(Vögel\); Tiergruppen werden nicht gemischt/);
  const site = loadContent(fixture({
    'content/butterflies/dryas-iulia/butterfly.yml': FALTER,
    'content/regions/see/butterflies.yml': 'name: See\ntitle: T\nbutterflies:\n  - id: dryas-iulia\nplaces:\n  sites:\n    - name: Ufer\n      birds: [dryas-iulia]\n',
  }));
  assert.match(messages(site.errors), /places\.sites\[0\]\.birds: Unbekanntes Feld „birds“/);
});

test('the folder name of an animal type cannot be a region', () => {
  const r = loadContent(fixture({ 'content/regions/schmetterlinge/region.yml': 'name: S\ntitle: S\nbirds:\n  - id: fischadler\n' }));
  assert.match(messages(r.errors), /„schmetterlinge“ ist für die Seiten der Tiergruppe Schmetterlinge reserviert/);
});

test('a region folder without any region file is reported', () => {
  const r = loadContent(fixture({ 'content/regions/leer/notiz.txt': 'x' }));
  assert.match(messages(r.errors), /keine Regionsdatei \(region\.yml, butterflies\.yml\)/);
});

test('a butterfly-only site has no switch and its overview at the root', () => {
  const dir = fixture({
    'content/regions/see/region.yml': null,
    'content/birds/fischadler/bird.yml': null,
    'content/butterflies/dryas-iulia/butterfly.yml': FALTER,
    'content/regions/see/butterflies.yml': FALTER_REGION,
  });
  const out = path.join(dir, '_site');
  const r = build({ root: dir, out });
  assert.ok(r.ok, messages(r.errors));
  const root = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(root, /<h1>Schmetterlingsführer<\/h1>/);
  assert.match(root, /href="schmetterlinge\/see\/"/);
  assert.doesNotMatch(root, /class="kinds"/);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'schmetterlinge', 'see', 'index.html'), 'utf8'), /class="kinds"/);
});

test('more species need a name or a scientific name; scientific names alone are italic', () => {
  const bad = loadContent(fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\nmore:\n  groups:\n    - title: G\n      species:\n        - en: Only English\n' }));
  assert.match(messages(bad.errors), /more\.groups\[0\]\.species\[0\]: Bitte name .* oder sci/);
  const dir = fixture({ 'content/regions/see/region.yml': 'name: See\ntitle: T\nbirds:\n  - id: fischadler\nmore:\n  groups:\n    - title: G\n      species:\n        - sci: Pandion haliaetus\n          en: Osprey\n' });
  const out = path.join(dir, '_site');
  assert.ok(build({ root: dir, out }).ok);
  assert.match(fs.readFileSync(path.join(out, 'see', 'index.html'), 'utf8'), /<li><strong><i>Pandion haliaetus<\/i><\/strong><span>Osprey<\/span><\/li>/);
});

test('a species named by its scientific name gets an italic heading without repeating it', () => {
  const dir = fixture({
    'content/butterflies/anartia-fatima/butterfly.yml': 'name: Anartia fatima\nenglish: Banded Peacock\nscientific: Anartia fatima\nwingspan: 5-7\ncolors: [braun]\nmarks: [A]\n',
    'content/regions/see/butterflies.yml': 'name: See\ntitle: T\nbutterflies:\n  - id: anartia-fatima\n',
  });
  const out = path.join(dir, '_site');
  assert.ok(build({ root: dir, out }).ok);
  const html = fs.readFileSync(path.join(out, 'schmetterlinge', 'see', 'index.html'), 'utf8');
  assert.match(html, /<h3><i>Anartia fatima<\/i><\/h3>\n<p class="names">Banded Peacock<\/p>/);
});

test('wingspan errors and hints name the wingspan', () => {
  const r = loadContent(fixture({
    'content/butterflies/x/butterfly.yml': 'name: X\nscientific: X y\nwingspan: groß\nmarks: [A]\ncolors: [rot]\n',
    'content/butterflies/z/butterfly.yml': 'name: Z\nscientific: Z y\nmarks: [A]\ncolors: [rot]\n',
    'content/regions/see/butterflies.yml': 'name: See\ntitle: T\nbutterflies:\n  - id: x\n  - id: z\n',
  }));
  assert.match(messages(r.errors), /wingspan: „groß“ ist keine Länge \(Spannweite in cm/);
  assert.match(messages(r.warnings), /wingspan: Spannweite fehlt \(z\. B\. wingspan: 7-9,5\); bei „Schmetterling gesehen\?“/);
});
