import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { slugify, nameAndId, insertBird, insertSpecies, yamlScalar, parseArgs } from '../scripts/lib/scaffold.mjs';
import { KINDS } from '../scripts/lib/kinds.mjs';

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

test('insertSpecies works on the list of every animal type in the shipped region files', () => {
  for (const dir of fs.readdirSync(path.join(ROOT, 'content/regions'))) {
    for (const kind of KINDS) {
      const file = path.join(ROOT, 'content/regions', dir, kind.guideFile);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const r = insertSpecies(text, kind.key, 'zz-test', ['  - id: zz-test']);
      assert.equal(r.status, 'ok', `${dir}/${kind.guideFile}: ${r.reason}`);
      assert.equal(YAML.parse(r.text)[kind.key].at(-1).id, 'zz-test');
    }
  }
  assert.equal(insertSpecies('butterflies:\n  - id: a\n', 'birds', 'b', ['  - id: b']).status, 'fail');
});

test('every animal type has templates for species and region files', () => {
  for (const kind of KINDS) {
    const species = fs.readFileSync(path.join(ROOT, 'vorlagen', kind.file), 'utf8');
    assert.match(species, /^name: __NAME__$/m, kind.file);
    assert.match(species, new RegExp(`^${kind.size.field}:`, 'm'), kind.file);
    const region = YAML.parse(fs.readFileSync(path.join(ROOT, 'vorlagen', kind.guideFile), 'utf8'));
    assert.ok(Array.isArray(region[kind.key]), `${kind.guideFile}: ${kind.key}`);
    assert.match(region.title, new RegExp(`^${kind.label} in __NAME__$`));
  }
});

test('neue-region --type copies the region name and suggests commands that work', async () => {
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-neue-region-'));
  for (const d of ['scripts', 'vorlagen']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  // Name mit YAML-Kommentar und Apostroph-Escape in der vorhandenen region.yml
  fs.mkdirSync(path.join(dir, 'content/regions/annecy'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'content/regions/annecy/region.yml'), "name: 'Lac d''Annecy' # Kurzname\ntitle: T\nbirds: []\n");
  const out = execFileSync(process.execPath, ['scripts/new-region.mjs', 'annecy', '--type', 'schmetterlinge'], { cwd: dir, encoding: 'utf8' });
  const created = YAML.parse(fs.readFileSync(path.join(dir, 'content/regions/annecy/butterflies.yml'), 'utf8'));
  assert.equal(created.name, "Lac d'Annecy");
  assert.equal(created.title, "Schmetterlinge in Lac d'Annecy");
  // Die vorgeschlagene Gruppe steht in der neuen Datei
  const groups = created.groups.map((g) => g.id);
  const suggested = [...out.matchAll(/--group (\S+)/g)].map((m) => m[1]);
  assert.ok(suggested.length >= 2, out);
  for (const g of suggested) assert.ok(groups.includes(g), `${g} nicht in ${groups.join(', ')}`);
  // … und der Befehl zum Wiederverwenden funktioniert
  const reuse = /npm run neue-art -- (\S+) --region annecy --group (\S+) --type schmetterlinge/.exec(out);
  assert.ok(reuse, out);
  fs.mkdirSync(path.join(dir, 'content/butterflies', reuse[1]), { recursive: true });
  execFileSync(process.execPath, ['scripts/new-bird.mjs', reuse[1], '--region', 'annecy', '--group', reuse[2], '--type', 'schmetterlinge'], { cwd: dir, encoding: 'utf8' });
  assert.equal(YAML.parse(fs.readFileSync(path.join(dir, 'content/regions/annecy/butterflies.yml'), 'utf8')).butterflies.at(-1).id, reuse[1]);
});

test('the example species for new ones do not exist yet; the reused ones do', () => {
  for (const kind of KINDS) {
    assert.ok(fs.existsSync(path.join(ROOT, 'content', kind.dir, kind.examples.existing)), kind.examples.existing);
    const id = slugify(kind.examples.new);
    assert.ok(!fs.existsSync(path.join(ROOT, 'content', kind.dir, id)), `${id} gibt es schon`);
  }
});
