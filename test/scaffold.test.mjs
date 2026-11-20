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

test('insertBird appends to the real region file without touching anything else', () => {
  const file = path.join(ROOT, 'content/regions/ometepe/region.yml');
  const text = fs.readFileSync(file, 'utf8');
  const r = insertBird(text, 'testvogel', ['  - id: testvogel', '    group: wald']);
  assert.equal(r.status, 'ok');
  const before = YAML.parse(text);
  const after = YAML.parse(r.text);
  assert.deepEqual(after.birds.slice(0, -1), before.birds);
  assert.deepEqual(after.birds.at(-1), { id: 'testvogel', group: 'wald' });
  assert.deepEqual({ ...after, birds: null }, { ...before, birds: null });
  // nur Zeilen hinzugefügt, keine geändert
  const lines = r.text.split('\n');
  const at = lines.indexOf('  - id: testvogel');
  assert.deepEqual(lines.slice(at, at + 2), ['  - id: testvogel', '    group: wald']);
  lines.splice(at, 2);
  assert.equal(lines.join('\n'), text);
  assert.equal(insertBird(text, 'fischadler', ['  - id: fischadler']).status, 'exists');
});

test('insertBird handles an empty flow list and refuses odd layouts', () => {
  const r = insertBird('name: X\nbirds: []\n# Kommentar\nother: 1\n', 'a', ['  - id: a']);
  assert.equal(r.status, 'ok');
  assert.deepEqual(YAML.parse(r.text), { name: 'X', birds: [{ id: 'a' }], other: 1 });
  const odd = insertBird('birds:\n- id: b\n', 'a', ['  - id: a']);
  assert.equal(odd.status, 'fail');
});

test('parseArgs refuses unquoted multi-word option values', () => {
  assert.deepEqual(parseArgs(['Rallenreiher', '--english', 'Squacco Heron'], ['english']), { _: ['Rallenreiher'], english: 'Squacco Heron' });
  assert.throws(() => parseArgs(['Rallenreiher', '--english', 'Squacco', 'Heron'], ['english']), /Anführungszeichen.*--english "Squacco Heron"/);
  assert.throws(() => parseArgs(['x', '--region'], ['region']), /braucht einen Wert/);
  assert.throws(() => parseArgs(['x', '--regon', 'a'], ['region']), /Unbekannte Option --regon/);
});
