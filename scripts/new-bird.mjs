#!/usr/bin/env node
// Legt eine neue Art an (Ordner content/birds/<id>/ mit bird.yml aus der Vorlage,
// bei --type schmetterlinge content/butterflies/<id>/butterfly.yml) und trägt sie auf
// Wunsch gleich in eine Region ein.
//
//   npm run neue-art -- "Grünreiher"
//   npm run neue-art -- "Grünreiher" --region ometepe --group wasser
//   npm run neue-art -- "Grünreiher" --english "Green Heron" --scientific "Butorides virescens"
//   npm run neue-art -- "Julia-Falter" --type schmetterlinge --region ometepe --group garten-waldrand
//
// Gibt es die Art schon, wird sie nur in die Region eingetragen
// (so lässt sich eine Art in mehreren Regionen verwenden).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { parseArgs, nameAndId, yamlScalar, insertSpecies } from './lib/scaffold.mjs';
import { KINDS, DEFAULT_KIND, findKind } from './lib/kinds.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

let existed = false;
let args;
try {
  args = parseArgs(process.argv.slice(2), ['region', 'group', 'english', 'scientific', 'type']);
} catch (e) {
  fail(e.message);
}
const kind = args.type ? findKind(args.type) : DEFAULT_KIND;
if (!kind) fail(`Tiergruppe „${args.type}“ gibt es nicht. Erlaubt: ${KINDS.map((k) => k.id).join(', ')}`);
const typeFlag = kind === DEFAULT_KIND ? '' : ` --type ${kind.id}`;
const parsed = nameAndId(args._.join(' '));
if (!parsed) {
  fail('Bitte einen Namen angeben, z. B.: npm run neue-art -- "Grünreiher" [--region ometepe] [--group wasser] [--type schmetterlinge]');
}
const { id, name, guessed } = parsed;
const dir = path.join(ROOT, 'content', kind.dir, id);
const rel = (p) => path.relative(ROOT, p);

// Region zuerst prüfen, damit bei Fehlern nichts halb angelegt wird
let regionFile = null;
if (args.region) {
  regionFile = path.join(ROOT, 'content', 'regions', args.region, kind.guideFile);
  if (!fs.existsSync(regionFile)) {
    const regionsDir = path.join(ROOT, 'content', 'regions');
    const regions = fs.existsSync(regionsDir) ? fs.readdirSync(regionsDir).filter((r) => fs.existsSync(path.join(regionsDir, r, kind.guideFile))) : [];
    fail(
      `Region „${args.region}“ hat keine Datei ${kind.guideFile} (${kind.label}). Vorhanden: ${regions.join(', ') || '(keine)'}` +
        (fs.existsSync(path.join(regionsDir, args.region)) ? `\nAnlegen mit: npm run neue-region -- ${args.region}${typeFlag}` : ''),
    );
  }
  let groups = [];
  try {
    groups = (YAML.parse(fs.readFileSync(regionFile, 'utf8'))?.groups || []).map((g) => g?.id).filter(Boolean);
  } catch {
    // Fehler in der Datei meldet später der Build
  }
  if (groups.length && !args.group) fail(`Die Region „${args.region}“ (${kind.label}) hat Lebensraum-Gruppen. Bitte eine angeben: --group ${groups.join(' | --group ')}`);
  if (groups.length && !groups.includes(args.group)) fail(`Gruppe „${args.group}“ gibt es in „${args.region}“ nicht. Erlaubt: ${groups.join(', ')}`);
}

if (fs.existsSync(dir)) {
  if (!args.region) fail(`Die Art „${id}“ gibt es schon: ${rel(dir)}/${kind.file}`);
  existed = true;
  console.log(`• Art „${id}“ gibt es schon, sie wird nur in die Region eingetragen.`);
} else {
  let text = fs.readFileSync(path.join(ROOT, 'vorlagen', kind.file), 'utf8');
  text = text.replace('name: __NAME__', () => `name: ${yamlScalar(name)}`);
  if (args.english) text = text.replace(/^english:$/m, () => `english: ${yamlScalar(args.english)}`);
  if (args.scientific) text = text.replace(/^scientific:$/m, () => `scientific: ${yamlScalar(args.scientific)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, kind.file), text);
  console.log(`✔ Angelegt: ${rel(dir)}/${kind.file}${guessed ? `  (Name „${name}“ bitte prüfen, z. B. Umlaute)` : ''}`);
}

if (regionFile) {
  const original = fs.readFileSync(regionFile, 'utf8');
  const entryLines = [`  - id: ${id}`, ...(args.group ? [`    group: ${args.group}`] : []), '    local:', '    status: ganzjährig', '    text: >-', '      Wo und wann man die Art in dieser Region findet.'];
  // Hinweis: Der Build meldet den Vorlagentext, bis er ersetzt ist.
  const result = insertSpecies(original, kind.key, id, entryLines);
  if (result.status === 'exists') {
    console.log(`• „${id}“ steht schon in ${rel(regionFile)}.`);
  } else if (result.status === 'ok') {
    fs.writeFileSync(regionFile, result.text);
    console.log(`✔ In ${rel(regionFile)} unter „${kind.key}“ eingetragen (local, status und text bitte anpassen).`);
  } else {
    console.log(`⚠ ${rel(regionFile)} konnte nicht automatisch ergänzt werden${result.reason ? ` (${result.reason})` : ''}. Bitte unter „${kind.key}:“ einfügen:\n\n${entryLines.join('\n')}\n`);
  }
}

if (existed) {
  console.log(`\nNächster Schritt: In content/regions/${args.region}/${kind.guideFile} local, status und text für „${id}“ anpassen. Vorschau: npm run dev`);
} else {
  console.log(`
Nächste Schritte:
  1. ${rel(dir)}/${kind.file} ausfüllen (Pflicht: name, scientific).
  2. Zeichnung als ${rel(dir)}/plate.svg ablegen (Vorlage: vorlagen/plate.svg).
     Ohne Zeichnung zeigt die Seite einen Platzhalter.
  3. Optional ein Foto in ${kind.file} eintragen und „npm run fotos“ ausführen.
  4. ${args.region ? '' : `In content/regions/<region>/${kind.guideFile} unter „${kind.key}“ eintragen. `}Vorschau: npm run dev`);
}
