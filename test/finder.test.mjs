// „Vogel gesehen?“: Daten (Farben, Längen, Nachbarorte) und die Bewertung aus assets/guide.js
// (Farben, Größe, Lebensraum, Ort, Monat).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import YAML from 'yaml';
import { parseColor, parseLength, lengthLabel, siteNeighbours, siteSlugs, COLORS, SIZE_CLASSES } from '../scripts/lib/finder.mjs';
import { BUTTERFLY_SIZES } from '../scripts/lib/kinds.mjs';
import { build } from '../scripts/build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/** Lädt die Bewertungsfunktionen aus guide.js ohne Browser (der DOM-Teil wird übersprungen). */
function scoring() {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/guide.js'), 'utf8'), sandbox);
  return sandbox.Vogelfuehrer;
}
const VF = scoring();
// Werte aus dem vm-Kontext haben andere Prototypen; für deepEqual umwandeln
const plainData = (v) => JSON.parse(JSON.stringify(v));
const palette = Object.fromEntries(COLORS.map((c) => [c.id, { label: c.label, near: c.near }]));
const size = (id) => SIZE_CLASSES.find((c) => c.id === id);

test('colours accept umlauts, ß and ASCII spellings and suggest corrections', () => {
  assert.equal(parseColor('Weiß'), 'weiss');
  assert.equal(parseColor('weiss'), 'weiss');
  assert.equal(parseColor('grün'), 'gruen');
  assert.equal(parseColor('Rotbraun'), 'rotbraun');
  assert.throws(() => parseColor('gruen-blau'), /keine der Farben/);
  assert.throws(() => parseColor('gelp'), /Meintest du „gelb“/);
});

test('colour neighbours are mutual', () => {
  for (const c of COLORS) {
    for (const n of c.near) assert.ok(COLORS.find((o) => o.id === n).near.includes(c.id), `${c.id} ↔ ${n}`);
  }
});

test('lengths are parsed from numbers, ranges and text', () => {
  assert.deepEqual(parseLength(23), [23, 23]);
  assert.deepEqual(parseLength('43-56'), [43, 56]);
  assert.deepEqual(parseLength('43–56 cm'), [43, 56]);
  assert.deepEqual(parseLength('ca. 10 cm'), [10, 10]);
  assert.deepEqual(parseLength([56, 43]), [43, 56]);
  assert.deepEqual(parseLength('9,5'), [9.5, 9.5]);
  assert.throws(() => parseLength('Spannweite 150 cm'), /keine Länge/);
  assert.throws(() => parseLength(0), /keine Länge/);
  assert.equal(lengthLabel([23, 23]), 'ca. 23 cm');
  assert.equal(lengthLabel([43, 56]), '43–56 cm');
});

test('neighbouring sites come from the map unless near is given', () => {
  // Vier Orte in einer Reihe und einer abseits: Nachbarn sind nur Orte ohne Ort dazwischen
  const sites = [{ pin: [0, 0] }, { pin: [10, 0] }, { pin: [20, 0] }, { pin: [30, 0] }, { pin: [15, 30] }];
  assert.deepEqual(siteNeighbours(sites), [[1], [0, 2, 4], [1, 3, 4], [2], [1, 2]]);
  // near legt die Nachbarn eines Ortes fest (gegenseitig), [] heißt: keine
  const explicit = sites.map((s) => ({ ...s }));
  explicit[0].nearIdx = [3];
  explicit[4].nearIdx = [];
  assert.deepEqual(siteNeighbours(explicit), [[3], [2], [1, 3], [0, 2], []]);
  // ohne Karte gibt es keine automatischen Nachbarn
  assert.deepEqual(siteNeighbours([{}, {}]), [[], []]);
});

test('site slugs are unique', () => {
  assert.deepEqual(siteSlugs([{ name: 'Río Istián' }, { name: 'Rio Istian' }, { name: '' }]), ['rio-istian', 'rio-istian-2', 'ort-3']);
});

test('month: present, adjacent or absent', () => {
  const winter = [9, 10, 11, 12, 1, 2, 3, 4];
  assert.equal(VF.monthPart(null, 7).score, 1);
  assert.equal(VF.monthPart(winter, 1).level, 'ja');
  const aug = VF.monthPart(winter, 8);
  assert.equal(aug.level, 'nah');
  assert.equal(aug.text, 'erst ab September');
  assert.equal(VF.monthPart(winter, 5).text, 'nur bis April');
  const jul = VF.monthPart(winter, 7);
  assert.equal(jul.level, 'nein');
  assert.ok(jul.score < aug.score && jul.score > 0, 'kein Ausschluss, nur weiter hinten');
});

test('size: matching, neighbouring and distant classes', () => {
  assert.equal(VF.sizePart([23, 25], size('amsel')).level, 'ja');
  assert.equal(VF.sizePart([30, 30], size('amsel')).level, 'ja', 'knapp über der Grenze zählt noch');
  const taube = VF.sizePart([34, 34], size('amsel'));
  assert.equal(taube.level, 'nah');
  assert.match(taube.text, /etwas größer \(ca\. 34 cm\)/);
  const kolibri = VF.sizePart([10, 10], size('amsel'));
  assert.equal(kolibri.level, 'nein');
  assert.match(kolibri.text, /viel kleiner/);
  assert.equal(VF.sizePart([80, 104], size('gans')).level, 'ja');
  assert.equal(VF.sizePart(null, size('gans')).level, 'offen');
});

test('place: here, next door, unassigned or elsewhere', () => {
  const places = [
    { name: 'A', near: [1] },
    { name: 'B', near: [0, 2] },
    { name: 'C', near: [1] },
  ];
  assert.equal(VF.placePart([0], 0, places).text, 'typisch für A');
  const next = VF.placePart([1], 0, places);
  assert.equal(next.level, 'nah');
  assert.equal(next.text, 'typisch für Nachbarort B');
  assert.equal(VF.placePart([], 0, places).level, 'offen');
  const far = VF.placePart([2], 0, places);
  assert.equal(far.level, 'nein');
  assert.equal(far.text, 'eher bei C');
  assert.ok(VF.placePart([1], 0, places).score > VF.placePart([], 0, places).score);
  assert.ok(VF.placePart([], 0, places).score > far.score);
});

test('habitat: listed, elsewhere or unknown', () => {
  const habitats = { wald: { label: 'Trockenwald & Gärten' }, wasser: { label: 'Seeufer & Feuchtgebiete' }, himmel: { label: 'Am Himmel' } };
  const wald = VF.habitatPart(['wald'], 'wald', habitats);
  assert.equal(wald.level, 'ja');
  assert.equal(wald.score, 1);
  assert.equal(wald.text, 'Trockenwald & Gärten');
  // Auch ein weiterer Lebensraum der Art passt voll
  const second = VF.habitatPart(['himmel', 'wasser'], 'wasser', habitats);
  assert.equal(second.level, 'ja');
  assert.equal(second.text, 'Seeufer & Feuchtgebiete');
  // Sonst nennt der Text den Hauptlebensraum der Art (die erste Gruppe)
  const elsewhere = VF.habitatPart(['himmel', 'wasser'], 'wald', habitats);
  assert.equal(elsewhere.level, 'nein');
  assert.equal(elsewhere.text, 'eher „Am Himmel“');
  assert.ok(elsewhere.score > 0 && elsewhere.score < 0.3, 'kein Ausschluss, nur weiter hinten');
  // Ohne Gruppen ist der Lebensraum offen und liegt zwischen Treffer und Fehlgriff
  for (const none of [null, []]) {
    const open = VF.habitatPart(none, 'wald', habitats);
    assert.equal(open.level, 'offen');
    assert.equal(open.text, 'Lebensraum unbekannt');
    assert.ok(open.score < wald.score && open.score > elsewhere.score);
  }
  // Eine Gruppe ohne Beschriftung erscheint mit ihrer id
  assert.equal(VF.habitatPart(['nacht'], 'wald', habitats).text, 'eher „nacht“');
});

test('colours: exact, similar and missing', () => {
  const r = VF.colorParts(['gruen', 'weiss'], ['blau', 'weiss', 'rot'], palette);
  assert.deepEqual(plainData(r.parts.map((p) => [p.level, p.text])), [['nah', 'Grün statt Blau'], ['ja', 'Weiß'], ['nein', 'kein Rot']]);
  assert.equal(r.score, 0.5);
  assert.equal(VF.colorParts(null, ['blau'], palette).parts[0].level, 'offen');
});

test('all answers count together; one mismatch sorts a species down but keeps it', () => {
  const ctx = { places: [{ name: 'A', near: [] }], colors: palette };
  const bird = { months: null, len: [43, 56], colors: ['blau', 'weiss', 'schwarz'], sites: [0] };
  const q = { month: 3, size: size('kraehe'), site: 0, colors: ['blau', 'weiss'] };
  const best = VF.rate(bird, q, ctx);
  assert.equal(best.score, 1);
  assert.equal(best.tier, 0);
  assert.equal(best.parts.length, 5);
  const wrongSize = VF.rate({ ...bird, len: [10, 10] }, q, ctx);
  assert.equal(wrongSize.tier, 2);
  assert.ok(wrongSize.score > 0);
  const nearSize = VF.rate({ ...bird, len: [34, 34] }, q, ctx);
  assert.equal(nearSize.tier, 1);
  assert.equal(VF.rate(bird, { colors: [] }, ctx).parts.length, 0, 'ohne Angaben keine Bewertung');
});

test('the habitat counts like the other answers, and parts follow the order on the page', () => {
  const ctx = { places: [{ name: 'A', near: [] }], colors: palette, habitats: { wald: { label: 'Wald' }, wasser: { label: 'Wasser' } } };
  const bird = { months: null, len: [43, 56], colors: ['blau', 'weiss'], groups: ['wald'], sites: [0] };
  // Reihenfolge wie die Fragen auf der Seite: Farben, Größe, Lebensraum, Ort, Monat
  const q = { month: 3, site: 0, habitat: 'wald', size: size('kraehe'), colors: ['blau', 'weiss'] };
  const r = VF.rate(bird, q, ctx);
  assert.equal(r.tier, 0);
  assert.deepEqual(plainData(r.parts.map((p) => p.text)), ['Blau', 'Weiß', 'Größe passt (43–56 cm)', 'Wald', 'typisch für A', 'im März']);
  // Falscher Lebensraum: die Art rutscht nach hinten, bleibt aber in der Liste
  const wrong = VF.rate(bird, { ...q, habitat: 'wasser' }, ctx);
  assert.equal(wrong.tier, 2);
  assert.ok(wrong.score > 0);
  assert.equal(wrong.parts[3].text, 'eher „Wald“');
  // Nur der Lebensraum
  assert.deepEqual(plainData(VF.rate(bird, { habitat: 'wald' }, ctx).parts.map((p) => p.level)), ['ja']);
  // Ein Lebensraum, den die Seite nicht anbietet, zählt nicht
  assert.equal(VF.rate(bird, { habitat: 'wueste' }, ctx).parts.length, 0);
  assert.equal(VF.rate(bird, { habitat: 'wald' }, { ...ctx, habitats: undefined }).parts.length, 0);
});

test('the real Ometepe page ranks sensibly', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-finder-'));
  const result = build({ root: ROOT, out: path.join(out, '_site') });
  assert.ok(result.ok);
  const html = fs.readFileSync(path.join(result.out, 'ometepe', 'index.html'), 'utf8');
  const attr = (tag, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1];
  const nums = (s) => (s == null ? null : s.split(' ').filter(Boolean).map(Number));
  const words = (s) => (s ? s.split(' ').filter(Boolean) : null);
  // Wie guide.js: Daten aus den Artkarten der Hauptseite
  const birds = [...html.matchAll(/<article class="bird"[^>]*>/g)].map(([tag]) => ({
    id: attr(tag, 'id'),
    months: nums(attr(tag, 'data-months')),
    len: nums(attr(tag, 'data-len')),
    colors: words(attr(tag, 'data-colors')),
    groups: words(attr(tag, 'data-groups')),
    sites: nums(attr(tag, 'data-sites')) || [],
  }));
  // Alle Arten der Regionsdatei, nach Hauptlebensraum geordnet (wie unter groups)
  const region = YAML.parse(fs.readFileSync(path.join(ROOT, 'content/regions/ometepe/region.yml'), 'utf8'));
  const main = (e) => (Array.isArray(e.group) ? e.group[0] : e.group);
  assert.deepEqual(
    birds.map((b) => b.id),
    region.groups.flatMap((g) => region.birds.filter((e) => main(e) === g.id).map((e) => e.id)),
  );
  assert.equal(birds.length, region.birds.length);
  assert.ok(birds.every((b) => b.len && b.colors), 'jede Art hat Länge und Farben');
  assert.ok(birds.every((b) => b.groups), 'jede Art hat einen Lebensraum');
  const places = [...html.matchAll(/<button type="button" data-o="([^"]+)" data-i="(\d+)" data-near="([^"]*)"/g)].map((m) => ({
    name: m[1],
    near: nums(m[3]),
  }));
  assert.equal(places.length, 5);
  const habitats = Object.fromEntries(
    [...html.matchAll(/<button type="button" data-l="([^"]+)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[1], { label: m[2].replace(/&amp;/g, '&') }]),
  );
  assert.deepEqual(Object.keys(habitats), ['wald', 'wasser', 'himmel', 'nacht']);
  assert.equal(habitats.wald.label, 'Trockenwald & Gärten');
  const ctx = { places, colors: palette, habitats };
  const rank = (q) =>
    birds
      .map((b, i) => ({ id: b.id, i, r: VF.rate(b, q, ctx) }))
      .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
      .map((x) => x.id);

  // Blau-weiß, krähengroß, an der Lagune von Charco Verde: der Langschwanzhäher
  assert.equal(rank({ month: 7, size: size('kraehe'), site: 0, colors: ['blau', 'weiss'] })[0], 'langschwanzhaeher');
  // Klein, grün und rotbraun: die Zimtbauchamazilie
  assert.equal(rank({ size: size('kolibri'), colors: ['gruen', 'rotbraun'] })[0], 'zimtamazilie');
  // Im Juli stehen die Wintergäste (darunter der Fischadler) hinten, im Januar nicht
  const july = rank({ month: 7 });
  const awayInJuly = birds.filter((b) => b.months && !b.months.includes(7)).map((b) => b.id);
  assert.ok(awayInJuly.includes('fischadler'));
  assert.deepEqual(july.slice(-awayInJuly.length).sort(), [...awayInJuly].sort());
  assert.notEqual(rank({ month: 1 }).at(-1), 'fischadler');
  // Am Río Istián stehen die Wasservögel vorn
  const istianBirds = [
    'blaureiher',
    'gelbstirn-blatthuehnchen',
    'herbstpfeifgans',
    'mangroveschwalbe',
    'nacktkehlreiher',
    'rallenkranich',
    'rotbrustfischer',
    'schneesichler',
    'schwarznacken-stelzenlaeufer',
    'silberreiher',
    'zwergsultanshuhn',
  ];
  const istian = rank({ site: 2 }).slice(0, istianBirds.length);
  assert.deepEqual([...istian].sort(), istianBirds);

  const tier = (id, q) => VF.rate(birds.find((b) => b.id === id), q, ctx).tier;
  const inGroup = (g) => birds.filter((b) => b.groups[0] === g).map((b) => b.id);
  // Nachts: die Nachtvögel, und nur sie passen gut
  const night = rank({ habitat: 'nacht' });
  const nightBirds = inGroup('nacht');
  assert.deepEqual([...nightBirds].sort(), ['dominikanertriel', 'mangrovekreischeule', 'pauraquenachtschwalbe']);
  assert.deepEqual(night.slice(0, nightBirds.length), nightBirds);
  assert.equal(night[0], 'mangrovekreischeule');
  for (const id of nightBirds) assert.equal(tier(id, { habitat: 'nacht' }), 0, id);
  assert.equal(tier(night[nightBirds.length], { habitat: 'nacht' }), 2);
  // Der Fischadler gehört zu [himmel, wasser]: am Seeufer passt er voll, steht aber unter „Am Himmel“
  const fischadler = birds.find((b) => b.id === 'fischadler');
  assert.deepEqual(fischadler.groups, ['himmel', 'wasser']);
  const water = VF.rate(fischadler, { habitat: 'wasser' }, ctx);
  assert.equal(water.parts[0].level, 'ja');
  assert.equal(water.parts[0].text, 'Seeufer & Feuchtgebiete');
  // Am Seeufer: zuerst die Wasservögel in der Reihenfolge der Liste, dann der Fischadler
  const waterBirds = inGroup('wasser');
  assert.deepEqual(waterBirds.slice(0, 5), ['nacktkehlreiher', 'silberreiher', 'rotbrustfischer', 'gelbstirn-blatthuehnchen', 'herbstpfeifgans']);
  assert.deepEqual(rank({ habitat: 'wasser' }).slice(0, waterBirds.length + 1), [...waterBirds, 'fischadler']);
  assert.equal(VF.rate(fischadler, { habitat: 'wald' }, ctx).parts[0].text, 'eher „Am Himmel“');
  // Am Himmel im Juli: die Arten, die das ganze Jahr da sind, vor den Wintergästen
  // (die Rauchschwalbe kommt im August zurück und steht deshalb vor dem Fischadler)
  const summerSky = rank({ habitat: 'himmel', month: 7 });
  const skyAllYear = birds.filter((b) => b.groups[0] === 'himmel' && !b.months).map((b) => b.id);
  assert.ok(skyAllYear.includes('rabengeier-truthahngeier') && skyAllYear.includes('schopfkarakara'));
  assert.deepEqual(summerSky.slice(0, skyAllYear.length), skyAllYear);
  assert.deepEqual(summerSky.slice(skyAllYear.length, skyAllYear.length + 2), ['rauchschwalbe', 'fischadler']);
  // Groß, weiß, am Wasser: der Silberreiher vorn; der Fischadler passt dort voll
  const bigWhiteWater = { habitat: 'wasser', size: size('gans'), colors: ['weiss'] };
  assert.equal(rank(bigWhiteWater)[0], 'silberreiher');
  assert.equal(tier('fischadler', bigWhiteWater), 0);
  // … am Himmel steht er dagegen ganz vorn
  assert.deepEqual(rank({ ...bigWhiteWater, habitat: 'himmel' }).slice(0, 2).sort(), ['fischadler', 'schopfkarakara']);
});

test('sizes with decimals are shown with a comma', () => {
  assert.equal(VF.sizePart([7.1, 10.2], { min: 8, max: 11 }).text, 'Größe passt (7,1–10,2 cm)');
  assert.equal(VF.sizePart([3.5, 3.5], { min: 8, max: 11 }).text, 'viel kleiner (ca. 3,5 cm)');
});

test('the real Ometepe butterfly page ranks sensibly', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'falter-finder-'));
  const result = build({ root: ROOT, out: path.join(out, '_site') });
  assert.ok(result.ok);
  const html = fs.readFileSync(path.join(result.out, 'schmetterlinge', 'ometepe', 'index.html'), 'utf8');
  const attr = (tag, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1];
  const nums = (s) => (s == null ? null : s.split(' ').filter(Boolean).map(Number));
  const words = (s) => (s ? s.split(' ').filter(Boolean) : null);
  const species = [...html.matchAll(/<article class="bird"[^>]*>/g)].map(([tag]) => ({
    id: attr(tag, 'id'),
    months: nums(attr(tag, 'data-months')),
    len: nums(attr(tag, 'data-len')),
    colors: words(attr(tag, 'data-colors')),
    groups: words(attr(tag, 'data-groups')),
    sites: nums(attr(tag, 'data-sites')) || [],
  }));
  assert.equal(species.length, 18);
  assert.ok(species.every((b) => b.len && b.colors && !b.months), 'jede Art hat Spannweite und Farben, keine Monate');
  assert.ok(species.every((b) => b.groups), 'jede Art hat einen Lebensraum');
  // Die Liste ist nach Lebensraum geordnet (wie unter groups in butterflies.yml)
  const guide = YAML.parse(fs.readFileSync(path.join(ROOT, 'content/regions/ometepe/butterflies.yml'), 'utf8'));
  const main = (e) => (Array.isArray(e.group) ? e.group[0] : e.group);
  assert.deepEqual(
    species.map((b) => b.id),
    guide.groups.flatMap((g) => guide.butterflies.filter((e) => main(e) === g.id).map((e) => e.id)),
  );
  const places = [...html.matchAll(/<button type="button" data-o="([^"]+)" data-i="(\d+)" data-near="([^"]*)"/g)].map((m) => ({ name: m[1], near: nums(m[3]) }));
  assert.equal(places.length, 6);
  const habitats = Object.fromEntries(
    [...html.matchAll(/<button type="button" data-l="([^"]+)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[1], { label: m[2].replace(/&amp;/g, '&') }]),
  );
  assert.deepEqual(Object.keys(habitats), guide.groups.map((g) => g.id));
  // Größen nach der Spannweite, mit eigenem Text für die Zusammenfassung
  const sizeBtns = [...html.matchAll(/<button type="button" data-s="([a-z]+)" data-min="[\d.]+" data-max="[\d.]+" data-say="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(sizeBtns, BUTTERFLY_SIZES.map((c) => [c.id, c.say]));
  const ctx = { places, colors: palette, habitats };
  const fsize = (id) => BUTTERFLY_SIZES.find((c) => c.id === id);
  const rank = (q) =>
    species
      .map((b, i) => ({ id: b.id, i, r: VF.rate(b, q, ctx) }))
      .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
      .map((x) => x.id);

  // Blau: der Morphofalter und Hamadryas guatemalena; im Wald nur der Morphofalter
  assert.deepEqual(rank({ colors: ['blau'] }).slice(0, 2).sort(), ['hamadryas-guatemalena', 'morpho-helenor']);
  assert.equal(rank({ habitat: 'wald', colors: ['blau'] })[0], 'morpho-helenor');
  // Grün und schwarz, handtellergroß: Malachitfalter und Urania; im Garten der Malachitfalter
  assert.deepEqual(rank({ size: fsize('handteller'), colors: ['gruen', 'schwarz'] }).slice(0, 2).sort(), ['siproeta-stelenes', 'urania-fulgens']);
  assert.equal(rank({ size: fsize('handteller'), colors: ['gruen', 'schwarz'], habitat: 'garten-waldrand' })[0], 'siproeta-stelenes');
  // Klein, schwarz und orange: Chlosyne lacinia
  assert.equal(rank({ size: fsize('blaeuling'), colors: ['schwarz', 'orange'] })[0], 'chlosyne-lacinia');
  // Riesig und braun: Schwarze Hexe oder Bananenfalter
  assert.ok(['ascalapha-odorata', 'caligo-telamonius'].includes(rank({ size: fsize('riesig'), colors: ['braun'] })[0]));
  // Am Weg zur Cascada San Ramón steht der Morphofalter vorn (dort drei der zehn Funde)
  const sanRamon = places.findIndex((p) => p.name.startsWith('san-ramon'));
  assert.ok(rank({ site: sanRamon, colors: ['blau'] })[0] === 'morpho-helenor');
});
