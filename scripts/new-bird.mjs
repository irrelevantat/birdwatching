#!/usr/bin/env node
// Legt eine neue Art an (Ordner content/birds/<id>/ mit bird.yml aus der Vorlage)
// und trägt sie auf Wunsch gleich in eine Region ein.
//
//   npm run neue-art -- "Grünreiher"
//   npm run neue-art -- "Grünreiher" --region ometepe --group wasser
//   npm run neue-art -- "Grünreiher" --english "Green Heron" --scientific "Butorides virescens"
//
// Gibt es die Art schon, wird sie nur in die Region eingetragen
// (so lässt sich eine Art in mehreren Regionen verwenden).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, nameAndId, yamlScalar, insertBird } from './lib/scaffold.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

let existed = false;
let args;
try {
  args = parseArgs(process.argv.slice(2), ['region', 'group', 'english', 'scientific']);
} catch (e) {
  fail(e.message);
}
const parsed = nameAndId(args._.join(' '));
if (!parsed) {
  fail('Bitte einen Namen angeben, z. B.: npm run neue-art -- "Grünreiher" [--region ometepe] [--group wasser]');
}
const { id, name, guessed } = parsed;
const dir = path.join(ROOT, 'content', 'birds', id);
const rel = (p) => path.relative(ROOT, p);

if (fs.existsSync(dir)) {
  if (!args.region) fail(`Die Art „${id}“ gibt es schon: ${rel(dir)}/bird.yml`);
  existed = true;
  console.log(`• Art „${id}“ gibt es schon, sie wird nur in die Region eingetragen.`);
} else {
  let text = fs.readFileSync(path.join(ROOT, 'vorlagen', 'bird.yml'), 'utf8');
  text = text.replace('name: __NAME__', `name: ${yamlScalar(name)}`);
  if (args.english) text = text.replace(/^english:$/m, `english: ${yamlScalar(args.english)}`);
  if (args.scientific) text = text.replace(/^scientific:$/m, `scientific: ${yamlScalar(args.scientific)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bird.yml'), text);
  console.log(`✔ Angelegt: ${rel(dir)}/bird.yml${guessed ? `  (Name „${name}“ bitte prüfen, z. B. Umlaute)` : ''}`);
}

if (args.region) {
  const regionFile = path.join(ROOT, 'content', 'regions', args.region, 'region.yml');
  if (!fs.existsSync(regionFile)) {
    const regions = fs.existsSync(path.join(ROOT, 'content', 'regions')) ? fs.readdirSync(path.join(ROOT, 'content', 'regions')) : [];
    fail(`Region „${args.region}“ nicht gefunden. Vorhanden: ${regions.join(', ') || '(keine)'}`);
  }
  const original = fs.readFileSync(regionFile, 'utf8');
  const entryLines = [`  - id: ${id}`, ...(args.group ? [`    group: ${args.group}`] : []), '    local:', '    status: ganzjährig', '    text: >-', '      Wo und wann man die Art in dieser Region findet.'];
  const result = insertBird(original, id, entryLines);
  if (result.status === 'exists') {
    console.log(`• „${id}“ steht schon in ${rel(regionFile)}.`);
  } else if (result.status === 'ok') {
    fs.writeFileSync(regionFile, result.text);
    console.log(`✔ In ${rel(regionFile)} unter „birds“ eingetragen (local, status und text bitte anpassen).`);
  } else {
    console.log(`⚠ ${rel(regionFile)} konnte nicht automatisch ergänzt werden${result.reason ? ` (${result.reason})` : ''}. Bitte unter „birds:“ einfügen:\n\n${entryLines.join('\n')}\n`);
  }
}

if (existed) {
  console.log(`\nNächster Schritt: In content/regions/${args.region}/region.yml local, status und text für „${id}“ anpassen. Vorschau: npm run dev`);
} else {
  console.log(`
Nächste Schritte:
  1. ${rel(dir)}/bird.yml ausfüllen (Pflicht: name, scientific).
  2. Zeichnung als ${rel(dir)}/plate.svg ablegen (Vorlage: vorlagen/plate.svg).
     Ohne Zeichnung zeigt die Seite einen Platzhalter.
  3. Optional ein Foto in bird.yml eintragen und „npm run fotos“ ausführen.
  4. ${args.region ? '' : 'In content/regions/<region>/region.yml unter „birds“ eintragen. '}Vorschau: npm run dev`);
}
