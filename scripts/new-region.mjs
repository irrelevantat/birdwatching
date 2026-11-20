#!/usr/bin/env node
// Legt eine neue Region an (Ordner content/regions/<id>/ mit region.yml aus der Vorlage).
// Mit --type schmetterlinge entsteht stattdessen butterflies.yml – auch in einem Ordner,
// in dem die Region für eine andere Tiergruppe schon existiert.
//
//   npm run neue-region -- "Neusiedler See"
//   npm run neue-region -- ometepe --type schmetterlinge
//
// Die neue Regionsdatei hat draft: true und erscheint erst auf der Website,
// wenn diese Zeile entfernt wird. In der Vorschau (npm run dev) ist sie sofort sichtbar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { parseArgs, nameAndId, yamlScalar, currentMonth } from './lib/scaffold.mjs';
import { KINDS, DEFAULT_KIND, findKind } from './lib/kinds.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

let args;
try {
  args = parseArgs(process.argv.slice(2), ['type']);
} catch (e) {
  fail(e.message);
}
const kind = args.type ? findKind(args.type) : DEFAULT_KIND;
if (!kind) fail(`Tiergruppe „${args.type}“ gibt es nicht. Erlaubt: ${KINDS.map((k) => k.id).join(', ')}`);
const parsed = nameAndId(args._.join(' '));
if (!parsed) fail('Bitte einen Namen angeben, z. B.: npm run neue-region -- "Neusiedler See" [--type schmetterlinge]');
const { id, guessed } = parsed;
let { name } = parsed;
const dir = path.join(ROOT, 'content', 'regions', id);
const rel = (p) => path.relative(ROOT, p);
const file = path.join(dir, kind.guideFile);
if (fs.existsSync(file)) fail(`Die Region „${id}“ gibt es für ${kind.label} schon: ${rel(file)}`);
const reserved = KINDS.find((k) => k.path === `${id}/`);
if (reserved) fail(`„${id}“ ist als Ordnername reserviert (Seiten der Tiergruppe ${reserved.label}). Bitte einen anderen Namen wählen.`);
// Existiert die Region schon (für eine andere Tiergruppe), ihren Namen übernehmen
const sibling = fs.existsSync(dir) ? KINDS.map((k) => path.join(dir, k.guideFile)).find((f) => fs.existsSync(f)) : null;
if (sibling && guessed) {
  try {
    const existing = YAML.parse(fs.readFileSync(sibling, 'utf8'))?.name;
    if (typeof existing === 'string' && existing.trim()) name = existing.trim();
  } catch {
    // Fehler in der Datei meldet später der Build; dann bleibt der Name aus der Eingabe
  }
}

let text = fs.readFileSync(path.join(ROOT, 'vorlagen', kind.guideFile), 'utf8');
const what = kind.label;
text = text
  .replace(/^name: __NAME__$/m, () => `name: ${yamlScalar(name)}`)
  .replace(new RegExp(`^title: ${what} in __NAME__$`, 'm'), () => `title: ${yamlScalar(`${what} in ${name}`)}`)
  .replace(/^local_heading: In __NAME__$/m, () => `local_heading: ${yamlScalar(`In ${name}`)}`)
  .replace(/^eyebrow: __NAME__$/m, () => `eyebrow: ${yamlScalar(name)}`)
  .replace(/^  map_label: Schematische Karte von __NAME__$/m, () => `  map_label: ${yamlScalar(`Schematische Karte von ${name}`)}`)
  .replace(/^updated: __MONAT__$/m, () => `updated: ${currentMonth()}`)
  .replace(/__NAME__/g, () => name);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, text);

const typeFlag = kind === DEFAULT_KIND ? '' : ` --type ${kind.id}`;
// Beispielgruppe aus der eben geschriebenen Datei, damit die Befehle unten so funktionieren
let group = '<gruppe>';
try {
  const first = YAML.parse(text)?.groups?.find((g) => g?.id)?.id;
  if (first) group = first;
} catch {
  // Vorlage ohne gültige groups: Platzhalter bleibt
}
const example = [kind.examples.existing, `"${kind.examples.new}"`, group];
const map = fs.existsSync(path.join(dir, 'map.svg'))
  ? `  3. Die Karte ${rel(dir)}/map.svg gilt für alle Tiergruppen; die Orte (pin) stehen in ${kind.guideFile}.`
  : `  3. Optional eine Karte als ${rel(dir)}/map.svg ablegen (Vorlage: vorlagen/map.svg).`;
console.log(`✔ Angelegt: ${rel(file)} (${kind.label})${guessed && !sibling ? `  (Name „${name}“ bitte prüfen, z. B. Umlaute)` : ''}

Nächste Schritte:
  1. ${rel(file)} ausfüllen (Titel, Einleitung, Lebensräume, Orte, Quellen).
  2. Arten eintragen. Vorhandene Arten wiederverwenden:
       npm run neue-art -- ${example[0]} --region ${id} --group ${example[2]}${typeFlag}
     Neue Art anlegen und eintragen:
       npm run neue-art -- ${example[1]} --region ${id} --group ${example[2]}${typeFlag}
     (--group: einer der Lebensräume unter „groups“ in ${kind.guideFile};
      mehrere später dort als Liste: group: [${example[2]}, …])
${map}
  4. Vorschau: npm run dev
  5. Zum Veröffentlichen die Zeile „draft: true“ entfernen.`);
