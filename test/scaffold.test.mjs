import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { slugify, nameAndId, insertBird, yamlScalar, parseArgs } from '../scripts/lib/scaffold.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('slugify transliterates German characters', () => {
  assert.equal(slugify('Grünreiher'), 'gruenreiher');
  assert.equal(slugify('Säbelschnäbler'), 'saebelschnaebler');
  assert.equal(slugify('Große Rohrdommel'), 'grosse-rohrdommel');
  assert.equal(slugify('Río Istián'), 'rio-istian');
});

test('nameAndId keeps the display name', () => {
  assert.deepEqual(nameAndId('Neusiedler See'), { id: 'neusiedler-see', name: 'Neusiedler See', guessed: false });
  assert.equal(nameAndId('fischadler').name, 'Fischadler');
  assert.equal(nameAndId('   '), null);
});

test('yamlScalar quotes only when needed', () => {
  assert.equal(yamlScalar('Grünreiher'), 'Grünreiher');
  assert.equal(yamlScalar('Hoffmann\'s Woodpecker'), 'Hoffmann\'s Woodpecker');
  assert.equal(yamlScalar('Achtung: Text'), '"Achtung: Text"');
  assert.equal(yamlScalar('yes'), '"yes"');
});

// Nachbildung des Aufbaus einer echten region.yml (Kommentare, Blocktexte, Felder davor und danach)
const REGION = `# Region Test. Alle Felder sind in ANLEITUNG.md erklärt.

# Kurzname
name: See
title: Vögel am See
lead: >-
  Ein längerer Text, der über
  mehrere Zeilen geht.

# Lebensraum-Filter
groups:
  - id: wald
    label: Wald & Gärten

# Arten dieser Region
birds:
  - id: fischadler
    group: wald
    local: Águila pescadora
    status: Wintergast
    text: >-
      Jagt über dem See,
      vor allem im Winter.
  - id: kolibri
    group: wald
    chips:
      - Nationalvogel
    text: Im Garten.

# Karte & Orte
places:
  intro: Zwei Orte.
  sites:
    - name: Ufer
      pin: [10, 20]
      birds: [fischadler]
`;

test('insertBird appends to a region file without touching anything else', () => {
  const r = insertBird(REGION, 'testvogel', ['  - id: testvogel', '    group: wald']);
  assert.equal(r.status, 'ok');
  const before = YAML.parse(REGION);
  const after = YAML.parse(r.text);
  assert.deepEqual(after.birds.slice(0, -1), before.birds);
  assert.deepEqual(after.birds.at(-1), { id: 'testvogel', group: 'wald' });
  assert.deepEqual({ ...after, birds: null }, { ...before, birds: null });
  // nur Zeilen hinzugefügt, keine geändert
  const lines = r.text.split('\n');
  const at = lines.indexOf('  - id: testvogel');
  assert.deepEqual(lines.slice(at, at + 2), ['  - id: testvogel', '    group: wald']);
  lines.splice(at, 2);
  assert.equal(lines.join('\n'), REGION);
  assert.equal(insertBird(REGION, 'fischadler', ['  - id: fischadler']).status, 'exists');
});

test('insertBird also works on the shipped region files', () => {
  for (const dir of fs.readdirSync(path.join(ROOT, 'content/regions'))) {
    const text = fs.readFileSync(path.join(ROOT, 'content/regions', dir, 'region.yml'), 'utf8');
    const r = insertBird(text, 'zz-testvogel', ['  - id: zz-testvogel']);
    assert.equal(r.status, 'ok', dir);
  }
});

test('insertBird handles an empty flow list and refuses odd layouts', () => {
  const r = insertBird('name: X\nbirds: []\n# Kommentar\nother: 1\n', 'a', ['  - id: a']);
  assert.equal(r.status, 'ok');
  assert.deepEqual(YAML.parse(r.text), { name: 'X', birds: [{ id: 'a' }], other: 1 });
  const odd = insertBird('birds:\n- id: b\n', 'a', ['  - id: a']);
  assert.equal(odd.status, 'fail');
});

test('parseArgs accepts the name after the options', () => {
  assert.deepEqual(parseArgs(['--region', 'ometepe', 'Grünreiher'], ['region']), { _: ['Grünreiher'], region: 'ometepe' });
});

test('parseArgs refuses unquoted multi-word option values', () => {
  assert.deepEqual(parseArgs(['Rallenreiher', '--english', 'Squacco Heron'], ['english']), { _: ['Rallenreiher'], english: 'Squacco Heron' });
  assert.throws(() => parseArgs(['Rallenreiher', '--english', 'Squacco', 'Heron'], ['english']), /Anführungszeichen.*--english "Squacco Heron"/);
  assert.throws(() => parseArgs(['x', '--region'], ['region']), /braucht einen Wert/);
  assert.throws(() => parseArgs(['x', '--regon', 'a'], ['region']), /Unbekannte Option --regon/);
});
