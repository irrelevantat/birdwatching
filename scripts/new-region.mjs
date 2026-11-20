#!/usr/bin/env node
// Legt eine neue Region an (Ordner content/regions/<id>/ mit region.yml aus der Vorlage).
//
//   npm run neue-region -- "Neusiedler See"
//
// Die neue Region hat draft: true und erscheint erst auf der Website,
// wenn diese Zeile entfernt wird. In der Vorschau (npm run dev) ist sie sofort sichtbar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, nameAndId, yamlScalar, currentMonth } from './lib/scaffold.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

let args;
try {
  args = parseArgs(process.argv.slice(2), []);
} catch (e) {
  fail(e.message);
}
const parsed = nameAndId(args._.join(' '));
if (!parsed) fail('Bitte einen Namen angeben, z. B.: npm run neue-region -- "Neusiedler See"');
const { id, name, guessed } = parsed;
const dir = path.join(ROOT, 'content', 'regions', id);
const rel = (p) => path.relative(ROOT, p);
if (fs.existsSync(dir)) fail(`Die Region „${id}“ gibt es schon: ${rel(dir)}/region.yml`);

let text = fs.readFileSync(path.join(ROOT, 'vorlagen', 'region.yml'), 'utf8');
text = text
  .replace(/^name: __NAME__$/m, `name: ${yamlScalar(name)}`)
  .replace(/^title: Vögel in __NAME__$/m, `title: ${yamlScalar(`Vögel in ${name}`)}`)
  .replace(/^eyebrow: __NAME__$/m, `eyebrow: ${yamlScalar(name)}`)
  .replace(/^updated: __MONAT__$/m, `updated: ${currentMonth()}`)
  .replace(/__NAME__/g, name);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'region.yml'), text);

console.log(`✔ Angelegt: ${rel(dir)}/region.yml${guessed ? `  (Name „${name}“ bitte prüfen, z. B. Umlaute)` : ''}

Nächste Schritte:
  1. ${rel(dir)}/region.yml ausfüllen (Titel, Einleitung, Orte, Quellen).
  2. Arten eintragen. Vorhandene Arten wiederverwenden:
       npm run neue-art -- fischadler --region ${id}
     Neue Art anlegen und eintragen:
       npm run neue-art -- "Grünreiher" --region ${id}
  3. Optional eine Karte als ${rel(dir)}/map.svg ablegen (Vorlage: vorlagen/map.svg).
  4. Vorschau: npm run dev
  5. Zum Veröffentlichen die Zeile „draft: true“ entfernen.`);
