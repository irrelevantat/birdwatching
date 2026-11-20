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
  assert.match(r.errors[0].path, /Zeile 3/);
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
  const dir = fixture({ 'content/regions/neu/region.yml': 'draft: true\nname: Neu\ntitle: Neu\nbirds: []\n' });
  const normal = loadContent(dir);
  assert.equal(normal.errors.length, 0, messages(normal.errors));
  assert.match(messages(normal.warnings), /Entwurf/);
  assert.equal(normal.regions.length, 1);
  const withDrafts = loadContent(dir, { drafts: true });
  assert.match(messages(withDrafts.errors), /mindestens eine Art/);
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
  assert.throws(() => build({ root: dir, out: dir }), /sieht nicht wie ein Build-Ordner aus/);
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
  const copied = fs.readFileSync(path.join(out, 'illustrations', 'fischadler.svg'), 'utf8');
  assert.doesNotMatch(copied, /<script|onclick/);
  assert.match(copied, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  const html = fs.readFileSync(path.join(out, 'see', 'index.html'), 'utf8');
  assert.match(html, /<figure class="slide illus"><img src="\.\.\/illustrations\/fischadler\.svg\?v=[0-9a-f]{10}" alt="Illustration: Fischadler"/);
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
