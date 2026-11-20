// Lädt alle Inhalte aus content/, prüft sie und bereitet sie für die Seiten auf.
// Jede Tiergruppe (scripts/lib/kinds.mjs) hat eigene Steckbriefe und Regionsdateien.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { check, siteSchema, speciesSchema, guideSchema } from './schema.mjs';
import { KINDS, DEFAULT_KIND } from './kinds.mjs';
import { prepareSvg, svgLabel, addPins, sanitizeSvgFile } from './svg.mjs';
import { parseMonths, suggest, numberWord, plural, fill } from './text.mjs';
import { parseColor, parseLength, lengthLabel, siteSlugs, siteNeighbours } from './finder.mjs';

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
export const PHOTO_SOURCE_FILE = '.photo-source';
export const ILLUSTRATION_FILE = 'illustration.svg';
export const ILLUSTRATION_SOURCE_FILE = '.illustration-source';
// Größer als nötig für eine Grafik; solche Dateien bremsen die Seite
const ILLUSTRATION_WARN_BYTES = 1024 * 1024;

const DRAFT_PREFIX = '(Entwurf, wird nicht veröffentlicht) ';

// Texte aus den Vorlagen (vorlagen/), die vor dem Veröffentlichen ersetzt werden müssen
const TEMPLATE_TEXTS = new Set([
  'Erstes Merkmal',
  'Zweites Merkmal',
  'Drittes Merkmal',
  'Wo und wann man die Art in dieser Region findet.',
  'Name der Art vor Ort',
  'Erster Ort',
  'Lebensraum in wenigen Worten',
  'Was man dort sieht und wie man hinkommt.',
  'Kurzer Überblick über die Beobachtungsorte.',
  'Ein Satz zur besten Reisezeit.',
  'Arten auf der regionalen Checkliste',
  'Deutscher Name',
  'English Name',
  'Name vor Ort',
  'Worauf sich die Angaben stützen.',
  'Autor: Titel (Jahr)',
  'https://example.org',
]);
const TEMPLATE_PREFIXES = ['Kurzer Text zum Verhalten', 'Ein, zwei Sätze zur Region', '__NAME__'];

export function commonsFileName(value) {
  let v = String(value).trim();
  v = v.replace(/^https?:\/\/commons\.(?:m\.)?wikimedia\.org\/wiki\//i, '');
  try {
    v = decodeURIComponent(v);
  } catch {
    // war nicht URL-kodiert
  }
  v = v.replace(/^(File|Datei|Image|Bild):/i, '');
  return v.replace(/_/g, ' ').trim();
}

export function commonsPageUrl(file) {
  const t = 'File:' + commonsFileName(file).replace(/ /g, '_');
  return 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(t).replace(/%2C/g, ',').replace(/%3A/g, ':');
}

export function licenseUrl(license) {
  const l = String(license).trim();
  const cc = /^CC[\s-]+(BY(?:-(?:SA|ND|NC|NC-SA|NC-ND))?)[\s-]+(\d\.\d)$/i.exec(l);
  if (cc) return `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`;
  if (/^CC0(\s+1\.0)?$/i.test(l)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/^(public domain|gemeinfrei|PD)\b/i.test(l)) return 'https://creativecommons.org/publicdomain/mark/1.0/';
  return null;
}

// ---------------------------------------------------------------------------
// YAML lesen

const YAML_MESSAGES = {
  TAB_AS_INDENT: 'Tabulator gefunden. Bitte nur Leerzeichen zum Einrücken verwenden.',
  DUPLICATE_KEY: 'Ein Feld steht doppelt im selben Block.',
  BLOCK_AS_IMPLICIT_KEY: 'Ein Text enthält „: “. Bitte den Text in Anführungszeichen setzen oder als Block mit >- schreiben.',
  MULTILINE_IMPLICIT_KEY: 'Ein Feldname oder Text läuft über mehrere Zeilen. Lange Texte als Block mit >- schreiben.',
  BAD_INDENT: 'Die Einrückung passt nicht zur Zeile darüber (gleiche Ebene = gleich viele Leerzeichen).',
  MISSING_CHAR: 'Hier fehlt ein Zeichen, oft der Doppelpunkt nach dem Feldnamen, oder die Einrückung stimmt nicht.',
  UNEXPECTED_TOKEN: 'Unerwartetes Zeichen. Einrückung und Anführungszeichen prüfen.',
  BAD_SCALAR_START: 'Ein Text beginnt mit einem Sonderzeichen (z. B. *, [, &, !, %, @). Bitte in Anführungszeichen setzen.',
  ALIAS_PROPS: 'Ein Text beginnt mit * oder &. Bitte in Anführungszeichen setzen.',
  UNRESOLVED_ALIAS: 'Ein Text beginnt mit *. Bitte in Anführungszeichen setzen, z. B. "*Ara macao* lebt hier."',
  MISSING_FLOW_ITEM: 'In einer Liste in eckigen Klammern fehlt ein Eintrag oder ein Komma.',
};

/** Pfad wie „birds[3].group“ in Bestandteile zerlegen: ['birds', 3, 'group']. */
function splitPath(p) {
  return (String(p).match(/[^.[\]]+|\[\d+\]/g) || []).map((t) => (/^\[\d+\]$/.test(t) ? Number(t.slice(1, -1)) : t));
}

/** Zeilennummer zu einem Feldpfad (oder zum nächsten vorhandenen übergeordneten Feld). */
function makeLocator(doc, lineCounter) {
  return (pathStr) => {
    if (!pathStr || /^Zeile /.test(pathStr)) return null;
    const parts = splitPath(pathStr);
    for (let n = parts.length; n > 0; n--) {
      const parent = n === 1 ? doc.contents : doc.getIn(parts.slice(0, n - 1), true);
      const last = parts[n - 1];
      let node = null;
      if (YAML.isMap(parent)) node = parent.items.find((it) => String(it.key?.value ?? it.key) === String(last))?.key;
      else if (YAML.isSeq(parent) && typeof last === 'number') node = parent.items[last];
      if (node?.range) return lineCounter.linePos(node.range[0]).line;
    }
    return null;
  };
}

/**
 * Liest eine YAML-Datei. Alle Werte bleiben Text (Schema „failsafe“), damit
 * z. B. „2.500“ oder „1.0“ genau so erscheinen, wie sie dastehen. Zahlen und
 * true/false wandelt erst die Prüfung um, wo ein Feld das verlangt.
 */
function readYaml(file, problems, locators) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    problems.errors.push({ file, path: '', message: `Datei fehlt oder ist nicht lesbar (${e.code || e.message})` });
    return undefined;
  }
  const lineCounter = new YAML.LineCounter();
  const doc = YAML.parseDocument(text, { schema: 'failsafe', prettyErrors: true, uniqueKeys: true, lineCounter });
  if (doc.errors.length) {
    // Nur den ersten Fehler melden: Weitere sind meist Folgefehler derselben Stelle.
    const err = doc.errors[0];
    const pos = err.linePos?.[0];
    const lines = text.split('\n');
    const nearTab = pos && [pos.line - 1, pos.line - 2, pos.line].some((i) => /^\s*\t/.test(lines[i] ?? '') || /\t/.test((lines[i] ?? '').match(/^\s*/)[0]));
    const hint = nearTab ? YAML_MESSAGES.TAB_AS_INDENT : YAML_MESSAGES[err.code];
    const detail = err.message.split('\n')[0].replace(/\s+at line \d+, column \d+:?\s*$/, '');
    problems.errors.push({
      file,
      path: '',
      line: pos?.line,
      message: `YAML-Fehler${pos ? ` in Spalte ${pos.col}` : ''}: ${hint || detail}${hint ? ` (${detail})` : ''}`,
    });
    return undefined;
  }
  for (const w of doc.warnings) problems.warnings.push({ file, path: '', line: w.linePos?.[0]?.line, message: `YAML: ${w.message.split('\n')[0]}` });
  // „Text #1“ ohne Anführungszeichen: alles ab „ #“ ist ein Kommentar und fehlt im Text
  YAML.visit(doc, {
    Scalar(_, node) {
      if (node.type === 'PLAIN' && node.comment && /^\S/.test(node.comment) && node.range) {
        problems.warnings.push({
          file,
          path: '',
          line: lineCounter.linePos(node.range[0]).line,
          message: `Text endet vor „ #${node.comment.slice(0, 20)}“. Gehört das zum Text, den ganzen Text in Anführungszeichen setzen.`,
        });
      }
    },
  });
  locators.set(file, makeLocator(doc, lineCounter));
  return doc.toJS() ?? {};
}

function validated(value, schema, file, problems) {
  const errors = [];
  const out = check(value, schema, '', errors);
  for (const e of errors) problems.errors.push({ file, path: e.path, message: e.message });
  return out;
}

/** Meldet Texte aus den Vorlagen, die noch nicht ersetzt wurden. */
function findTemplateTexts(value, file, problems, at = '') {
  if (typeof value === 'string') {
    const v = value.trim();
    if (TEMPLATE_TEXTS.has(v) || TEMPLATE_PREFIXES.some((p) => v.startsWith(p))) {
      // Ob Fehler oder Hinweis, entscheidet loadContent (nur veröffentlichte Inhalte müssen fertig sein)
      problems.templates.push({ file, path: at, message: `Vorlagentext noch nicht ersetzt: „${v.slice(0, 50)}“` });
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findTemplateTexts(v, file, problems, `${at}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) findTemplateTexts(v, file, problems, at ? `${at}.${k}` : k);
  }
}

/** Ersetzt {arten} und {orte} in allen Texten der Region. */
function fillAll(value, vars) {
  if (typeof value === 'string') return fill(value, vars);
  if (Array.isArray(value)) return value.map((v) => fillAll(v, vars));
  if (value && typeof value === 'object' && !(value instanceof Set)) {
    for (const k of Object.keys(value)) value[k] = fillAll(value[k], vars);
  }
  return value;
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

function findPhotos(dir) {
  return PHOTO_EXTENSIONS.map((ext) => path.join(dir, 'photo' + ext)).filter((f) => fs.existsSync(f));
}

const MEDIA_LABEL = { photo: 'Foto', illustration: 'Illustration' };

/** Quelle, Lizenz-Link und Bildunterschrift für ein Foto oder eine Illustration. */
function mediaSource(p, bird, file, field, problems) {
  if (!p.file && !p.url) {
    problems.errors.push({ file, path: field, message: `${MEDIA_LABEL[field]} braucht „file“ (Dateiname auf Wikimedia Commons) oder „url“ (Seite der Quelle)` });
  }
  if (p.file) {
    p.file = commonsFileName(p.file);
    p.page = commonsPageUrl(p.file);
    p.source = p.source || 'Wikimedia Commons';
  } else {
    p.page = p.url;
    if (!p.source) problems.warnings.push({ file, path: `${field}.source`, message: `Quelle ${field === 'photo' ? 'des Fotos' : 'der Illustration'} fehlt (z. B. „Flickr“)` });
  }
  p.licenseUrl = p.license_url || licenseUrl(p.license);
  if (!p.licenseUrl) problems.warnings.push({ file, path: `${field}.license`, message: `Lizenz „${p.license}“ unbekannt; bitte license_url angeben` });
  p.caption = p.caption || bird.name;
}

/** true, wenn die geladene Datei laut Merkdatei von einer anderen Commons-Datei stammt. */
function isStale(p, marker, file, field, subject, command, problems) {
  if (!p.file || !fs.existsSync(marker)) return false;
  const source = fs.readFileSync(marker, 'utf8').trim();
  if (source === p.file) return false;
  problems.warnings.push({ file, path: `${field}.file`, message: `${subject} stammt von „${source}“, nicht von „${p.file}“. Es wird nicht angezeigt. Neu laden mit: ${command}` });
  return true;
}

// ---------------------------------------------------------------------------
// Arten (Steckbriefe einer Tiergruppe)

function loadSpecies(kind, id, dir, problems, locators) {
  const file = path.join(dir, kind.file);
  if (!ID_PATTERN.test(id)) {
    problems.errors.push({ file: dir, path: '', message: `Ordnername „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben a–z, Ziffern und Bindestriche (ä → ae, ö → oe, ü → ue, ß → ss).` });
  }
  const raw = readYaml(file, problems, locators);
  if (raw === undefined) return null;
  const data = validated(raw, speciesSchema(kind), file, problems);
  if (!data || !data.name || !data.scientific) return null;
  findTemplateTexts(data, file, problems);

  const bird = { id, dir, file, kind, ...data };
  if (!bird.english) {
    problems.warnings.push({ file, path: 'english', message: kind.id === 'voegel' ? 'Englischer Name fehlt (wird für die xeno-canto-Suche genutzt)' : 'Englischer Name fehlt' });
  }
  if (!bird.marks?.length) problems.warnings.push({ file, path: 'marks', message: 'Keine Merkmale angegeben' });

  // Größe (Körperlänge oder Spannweite) und Farben für „… gesehen?“
  const size = kind.size;
  const sizeValue = bird[size.field];
  if (sizeValue !== undefined) {
    try {
      bird.len = parseLength(sizeValue, size.hint);
    } catch (e) {
      problems.errors.push({ file, path: size.field, message: e.message });
    }
  } else {
    problems.warnings.push({ file, path: size.field, message: `${size.what} fehlt (z. B. ${size.field}: ${size.example}); bei „${kind.one} gesehen?“ zählt die Größe dann nicht` });
  }
  bird.sizeLabel = bird.size || (bird.len ? size.chip(bird.len) : null);
  if (bird.colors?.length) {
    bird.colorIds = [];
    bird.colors.forEach((c, i) => {
      try {
        const id = parseColor(c);
        if (!bird.colorIds.includes(id)) bird.colorIds.push(id);
      } catch (e) {
        problems.errors.push({ file, path: `colors[${i}]`, message: e.message });
      }
    });
  } else {
    problems.warnings.push({ file, path: 'colors', message: `Farben fehlen (z. B. colors: [grün, gelb]); bei „${kind.one} gesehen?“ zählen die Farben dann nicht` });
  }

  const photos = findPhotos(dir);
  if (photos.length > 1) {
    problems.warnings.push({ file, path: 'photo', message: `Mehrere Fotodateien im Ordner (${photos.map((f) => path.basename(f)).join(', ')}). Verwendet wird ${path.basename(photos[0])}; bitte die übrigen löschen.` });
  }
  const marker = path.join(dir, PHOTO_SOURCE_FILE);
  const markerSource = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : null;

  if (bird.photo) {
    const p = bird.photo;
    mediaSource(p, bird, file, 'photo', problems);
    p.local = photos[0] || null;
    // „npm run fotos“ merkt sich in .photo-source, zu welcher Commons-Datei das Foto gehört.
    // Passt das nicht mehr zum Steckbrief, wird das alte Foto nicht angezeigt (falsche Lizenzangabe).
    if (p.local && p.file && markerSource === null) {
      // Foto ohne Herkunftsvermerk: Es stammt nicht sicher von der angegebenen Commons-Datei
      problems.warnings.push({
        file,
        path: 'photo.file',
        message: `Das Foto im Ordner hat keinen Herkunftsvermerk (${PHOTO_SOURCE_FILE}) und stammt nicht sicher von „${p.file}“. Es wird nicht angezeigt. Neu laden mit: npm run fotos`,
      });
      p.local = null;
      p.stale = true;
    } else if (p.local && markerSource !== null && markerSource !== (p.file || '')) {
      problems.warnings.push({
        file,
        path: p.file ? 'photo.file' : 'photo.url',
        message: p.file
          ? `Das gespeicherte Foto stammt von „${markerSource}“, nicht von „${p.file}“. Es wird nicht angezeigt. Neu laden mit: npm run fotos`
          : `Das gespeicherte Foto stammt von Commons („${markerSource}“). Für ein Foto mit url bitte das Bild ersetzen und ${PHOTO_SOURCE_FILE} löschen.`,
      });
      p.local = null;
      p.stale = true;
    }
  } else if (photos.length) {
    problems.warnings.push({ file, path: 'photo', message: 'Es liegt eine Fotodatei im Ordner, aber ohne Angaben zu Urheber und Lizenz. Sie wird nicht angezeigt.' });
  }

  // Illustration: frei lizenzierte SVG-Grafik, die im Repository liegt
  const illustrationFile = path.join(dir, ILLUSTRATION_FILE);
  const hasIllustration = fs.existsSync(illustrationFile);
  if (bird.illustration) {
    const il = bird.illustration;
    mediaSource(il, bird, file, 'illustration', problems);
    if (il.license && !/^(CC0?|public domain|gemeinfrei|PD)\b/i.test(il.license.trim())) {
      problems.warnings.push({ file, path: 'illustration.license', message: `„${il.license}“ ist keine Creative-Commons-Lizenz. Bitte nur CC-lizenzierte oder gemeinfreie Grafiken verwenden.` });
    }
    il.local = null;
    if (!hasIllustration) {
      problems.warnings.push({
        file,
        path: 'illustration',
        message: il.file
          ? `${ILLUSTRATION_FILE} fehlt noch im Ordner der Art. Laden mit: npm run grafiken -- ${id}`
          : `${ILLUSTRATION_FILE} fehlt noch im Ordner der Art (Datei von der Quelle herunterladen und dort ablegen)`,
      });
    } else if (isStale(il, path.join(dir, ILLUSTRATION_SOURCE_FILE), file, 'illustration', 'Die gespeicherte Grafik', `npm run grafiken -- ${id}`, problems)) {
      il.stale = true;
    } else {
      try {
        const src = fs.readFileSync(illustrationFile);
        if (src.length > ILLUSTRATION_WARN_BYTES) {
          problems.warnings.push({ file: illustrationFile, path: '', message: `Datei ist ${Math.round(src.length / 1024)} KB groß; Grafiken über 1 MB laden langsam` });
        }
        const prepared = sanitizeSvgFile(src.toString('utf8'));
        for (const w of prepared.warnings) problems.warnings.push({ file: illustrationFile, path: '', message: w });
        il.local = illustrationFile;
        il.svg = prepared.svg;
      } catch (e) {
        problems.errors.push({ file: illustrationFile, path: '', message: e.message });
      }
    }
  } else if (hasIllustration) {
    problems.warnings.push({ file, path: 'illustration', message: `Es liegt eine ${ILLUSTRATION_FILE} im Ordner, aber ohne Angaben zu Urheber und Lizenz (illustration in ${kind.file}). Sie wird nicht angezeigt.` });
  }

  // Zeichnung
  const plateFile = path.join(dir, 'plate.svg');
  bird.plate = null;
  if (fs.existsSync(plateFile)) {
    try {
      const src = fs.readFileSync(plateFile, 'utf8');
      const own = svgLabel(src);
      const label = own && !/NAME DER ART/.test(own) ? own : `Schematische Zeichnung: ${bird.title || bird.name}`;
      const prepared = prepareSvg(src, { prefix: id, className: 'plate', label });
      for (const w of prepared.warnings) problems.warnings.push({ file: plateFile, path: '', message: w });
      bird.plate = prepared;
      const n = bird.marks?.length || 0;
      if (prepared.markers && n && prepared.markers !== n) {
        problems.warnings.push({ file: plateFile, path: '', message: `Zeichnung hat ${prepared.markers} Nummern-Markierungen, ${kind.file} aber ${n} Merkmale` });
      }
    } catch (e) {
      problems.errors.push({ file: plateFile, path: '', message: e.message });
    }
  } else {
    problems.warnings.push({ file: dir, path: '', message: 'Noch keine Zeichnung (plate.svg); es wird ein Platzhalter angezeigt' });
  }
  return bird;
}

// ---------------------------------------------------------------------------
// Regionen: je Tiergruppe eine Datei im Ordner der Region (region.yml, butterflies.yml …)

function loadGuide(kind, id, dir, species, others, problems, broken, locators) {
  const file = path.join(dir, kind.guideFile);
  const key = kind.key;
  if (!ID_PATTERN.test(id)) {
    problems.errors.push({ file: dir, path: '', message: `Ordnername „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben a–z, Ziffern und Bindestriche.` });
  }
  const reserved = KINDS.find((k) => k.path === `${id}/`);
  if (reserved) {
    problems.errors.push({ file: dir, path: '', message: `Ordnername „${id}“ ist für die Seiten der Tiergruppe ${reserved.label} reserviert. Bitte die Region anders nennen.` });
  }
  const raw = readYaml(file, problems, locators);
  if (raw === undefined) return null;
  const schema = guideSchema(kind);
  const data = validated(raw, schema, file, problems);
  if (!data || !data.name || !data.title) return null;
  findTemplateTexts(data, file, problems);
  const region = { id, dir, file, kind, path: `${kind.path}${id}/`, ...data };

  // Gruppen
  const groups = (region.groups || []).filter(Boolean);
  const groupIds = new Set();
  groups.forEach((g, i) => {
    if (!g.id) return;
    if (!ID_PATTERN.test(g.id)) problems.errors.push({ file, path: `groups[${i}].id`, message: `„${g.id}“: nur Kleinbuchstaben, Ziffern, Bindestriche` });
    if (g.id === 'alle') problems.errors.push({ file, path: `groups[${i}].id`, message: '„alle“ ist reserviert' });
    if (groupIds.has(g.id)) problems.errors.push({ file, path: `groups[${i}].id`, message: `Gruppe „${g.id}“ doppelt` });
    groupIds.add(g.id);
  });
  region.groups = groups;

  // Arten (nur aus der eigenen Tiergruppe)
  const seen = new Set();
  const brokenHere = new Set();
  const brokenGroups = new Set();
  region.entries = [];
  (region[key] || []).forEach((entry, i) => {
    if (!entry || !entry.id) return;
    const at = `${key}[${i}]`;
    const bird = species.get(entry.id);
    if (!bird && broken.has(entry.id)) {
      // Steckbrief hat selbst Fehler (dort gemeldet); keine Folgefehler erzeugen
      brokenHere.add(entry.id);
      for (const g of [].concat(entry.group ?? [])) if (typeof g === 'string') brokenGroups.add(g);
      return;
    }
    if (!bird) {
      const elsewhere = others.find((o) => o.species.has(entry.id));
      const s = suggest(entry.id, [...species.keys()]);
      const create = `npm run neue-art -- ${entry.id} --region ${id}${kind === DEFAULT_KIND ? '' : ` --type ${kind.id}`}`;
      problems.errors.push({
        file,
        path: `${at}.id`,
        message:
          `Art „${entry.id}“ gibt es nicht unter content/${kind.dir}/.` +
          (elsewhere
            ? ` Sie liegt unter content/${elsewhere.kind.dir}/ (${elsewhere.kind.label}); Tiergruppen werden nicht gemischt.`
            : s
              ? ` Meintest du „${s}“?`
              : ` Lege sie mit „${create}“ an.`),
      });
      return;
    }
    if (seen.has(entry.id)) {
      problems.errors.push({ file, path: `${at}.id`, message: `Art „${entry.id}“ steht doppelt in der Liste` });
      return;
    }
    seen.add(entry.id);
    // group: eine id oder eine Liste von ids; die erste ist die Hauptgruppe (Überschrift in der Artenliste)
    const groupList = [];
    const rawGroups = entry.group === undefined || entry.group === null ? [] : Array.isArray(entry.group) ? entry.group : [entry.group];
    rawGroups.forEach((g, j) => {
      const where = Array.isArray(entry.group) ? `${at}.group[${j}]` : `${at}.group`;
      if (typeof g !== 'string' || !g.trim()) {
        problems.errors.push({ file, path: where, message: `Art „${entry.id}“: group braucht die id einer Gruppe, z. B. „group: wald“ oder „group: [himmel, wasser]“` });
        return;
      }
      if (groups.length && !groupIds.has(g)) {
        const s = suggest(g, [...groupIds]);
        problems.errors.push({
          file,
          path: where,
          message: `Art „${entry.id}“: Gruppe „${g}“ ist oben unter groups nicht definiert.` + (s ? ` Meintest du „${s}“?` : ` Erlaubt: ${[...groupIds].join(', ')}`),
        });
        return;
      }
      if (!groupList.includes(g)) groupList.push(g);
    });
    if (groups.length) {
      if (!rawGroups.length) {
        problems.errors.push({ file, path: `${at}.id`, message: `Art „${entry.id}“: Gruppe fehlt (group: …). Erlaubt: ${[...groupIds].join(', ')}` });
      }
    } else if (rawGroups.length) {
      problems.warnings.push({ file, path: `${at}.group`, message: `Art „${entry.id}“: Gruppe angegeben, aber die Region hat keine groups; die Angabe wird ignoriert` });
      groupList.length = 0;
    }
    let monthSet = null;
    if (entry.months !== undefined) {
      try {
        monthSet = parseMonths(entry.months);
      } catch (e) {
        problems.errors.push({ file, path: `${at}.months`, message: e.message });
      }
    }
    region.entries.push({ ...entry, group: groupList[0], groups: groupList, species: bird, monthSet });
  });
  region.hasBroken = brokenHere.size > 0;
  if (!region.entries.length && !region.hasBroken) {
    // Ein frisch angelegter Entwurf darf (noch) leer sein
    (region.draft ? problems.warnings : problems.errors).push({ file, path: key, message: 'Die Region braucht mindestens eine Art' });
  }
  for (const g of groups) {
    if (g.id && !brokenGroups.has(g.id) && !region.entries.some((e) => e.groups.includes(g.id))) {
      problems.warnings.push({ file, path: 'groups', message: `Gruppe „${g.id}“ hat keine Arten und wird nicht angezeigt` });
    }
  }

  // Weitere Arten: Name oder wissenschaftlicher Name
  (region.more?.groups || []).forEach((g, i) => {
    (g?.species || []).forEach((sp, j) => {
      if (sp && !sp.name && !sp.sci) problems.errors.push({ file, path: `more.groups[${i}].species[${j}]`, message: 'Bitte name (deutscher Name) oder sci (wissenschaftlicher Name) angeben' });
    });
  });

  // Karte & Orte
  const mapFile = path.join(dir, 'map.svg');
  const sites = (region.places?.sites || []).filter(Boolean);
  region.sites = sites;
  sites.forEach((site, i) => {
    (site[key] || []).filter(Boolean).forEach((bid, j) => {
      if (!seen.has(bid) && !brokenHere.has(bid)) {
        const s = suggest(bid, [...seen]);
        problems.errors.push({
          file,
          path: `places.sites[${i}].${key}[${j}]`,
          message: `Ort „${site.name}“: „${bid}“ ist keine Art dieser Region (Liste ${key} oben).` + (s ? ` Meintest du „${s}“?` : ''),
        });
      }
    });
    if (site.pin && (site.pin.length !== 2 || site.pin.some((v) => typeof v !== 'number'))) {
      problems.errors.push({ file, path: `places.sites[${i}].pin`, message: `Ort „${site.name}“: pin braucht genau zwei Zahlen: [x, y]` });
      site.pin = undefined;
    }
  });

  // Platzhalter {arten}/{orte} in allen Texten der Region ersetzen
  region.vars = { arten: region.entries.length, orte: sites.length };
  for (const field of Object.keys(schema.fields)) {
    if (field !== key && region[field] !== undefined) region[field] = fillAll(region[field], region.vars);
  }
  region.entries.forEach((e) => {
    for (const k of ['local', 'status', 'text']) if (e[k]) e[k] = fill(e[k], region.vars);
    if (e.chips) e.chips = e.chips.map((c) => fill(c, region.vars));
  });
  region.sites = region.places?.sites?.filter(Boolean) || [];
  // Angrenzende Orte (für „… gesehen?“)
  siteSlugs(sites).forEach((slug, i) => {
    sites[i].slug = slug;
  });
  const nameKey = (name) => String(name ?? '').trim().toLowerCase();
  sites.forEach((site, i) => {
    if (!site.near) return;
    site.nearIdx = [];
    site.near.forEach((name, j) => {
      const k = sites.findIndex((o) => nameKey(o.name) === nameKey(name));
      if (k < 0) {
        const s = suggest(name, sites.map((o) => o.name).filter(Boolean));
        problems.errors.push({ file, path: `places.sites[${i}].near[${j}]`, message: `„${name}“ ist kein Ort dieser Region (Namen unter places.sites).` + (s ? ` Meintest du „${s}“?` : '') });
      } else if (k === i) {
        problems.errors.push({ file, path: `places.sites[${i}].near[${j}]`, message: 'Ein Ort kann nicht an sich selbst angrenzen' });
      } else if (!site.nearIdx.includes(k)) {
        site.nearIdx.push(k);
      }
    });
  });
  siteNeighbours(sites).forEach((list, i) => {
    sites[i].neighbours = list;
  });
  for (const e of region.entries) {
    e.siteIdx = sites.map((s, i) => ((s[key] || []).includes(e.id) ? i : -1)).filter((i) => i >= 0);
  }

  region.map = null;
  if (fs.existsSync(mapFile)) {
    try {
      const src = fs.readFileSync(mapFile, 'utf8');
      const base = region.places?.map_label || svgLabel(src) || `Schematische Karte: ${region.name}`;
      const pins = region.sites.map((s, i) => (s.pin ? { n: i + 1, x: s.pin[0], y: s.pin[1] } : null)).filter(Boolean);
      const label = pins.length
        ? `${base} mit ${numberWord(pins.length, { one: 'einem' })} ${plural(pins.length, 'Beobachtungsort', 'Beobachtungsorten')}`
        : base;
      const prepared = prepareSvg(src, { prefix: `map-${kind.id}-${id}`, className: 'map', label });
      for (const w of prepared.warnings) problems.warnings.push({ file: mapFile, path: '', message: w });
      // Auf der Seite „Orte“ führen die Nummern zur Beschreibung des Ortes; auf der Startseite
      // liegt die Karte in einem Link und bekommt deshalb keine eigenen Links
      const linked = region.sites
        .map((s, i) => (s.pin ? { n: i + 1, x: s.pin[0], y: s.pin[1], href: `#${s.slug}`, label: `${i + 1}: ${s.name}` } : null))
        .filter(Boolean);
      region.map = { svg: addPins(prepared.svg, pins), linkedSvg: addPins(prepared.svg, linked), label, pins: pins.length };
      region.sites.forEach((s, i) => {
        if (!s.pin) problems.warnings.push({ file, path: `places.sites[${i}]`, message: `Ort „${s.name}“ hat keine Position auf der Karte (pin: [x, y])` });
      });
    } catch (e) {
      problems.errors.push({ file: mapFile, path: '', message: e.message });
    }
  } else if (region.sites.some((s) => s.pin)) {
    problems.warnings.push({ file, path: 'places.sites', message: 'Orte haben pin-Positionen, aber es gibt keine map.svg' });
  }

  // Jahreszeiten
  (region.season?.rows || []).forEach((row, i) => {
    if (!row) return;
    try {
      row.monthSet = parseMonths(row.months);
    } catch (e) {
      problems.errors.push({ file, path: `season.rows[${i}].months`, message: e.message });
      row.monthSet = new Set();
    }
  });

  return region;
}

/**
 * Art-ids aus einer Regionsdatei, die nicht geladen werden konnte (z. B. YAML-Fehler).
 * So zählen Arten aus einem kaputten Entwurf trotzdem als „nur im Entwurf“.
 */
function tolerantRefs(file, key) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  try {
    const data = YAML.parseDocument(text, { schema: 'failsafe' }).toJS();
    if (Array.isArray(data?.[key])) return data[key].map((b) => b?.id).filter((id) => typeof id === 'string');
  } catch {
    // weiter mit der Textsuche
  }
  const section = new RegExp(`^${key}:[^\\n]*\\n([\\s\\S]*?)(?=^[^\\s#-]|(?![\\s\\S]))`, 'm').exec(text);
  return section ? [...section[1].matchAll(/^[ \t]*-[ \t]*id:[ \t]*["']?([a-z0-9-]+)/gm)].map((m) => m[1]) : [];
}

function isDraftFile(file) {
  try {
    return /^draft:\s*["']?(true|yes|ja)["']?\s*(#.*)?$/im.test(fs.readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

/**
 * Lädt alles. `drafts`: Regionen mit draft: true mitbauen.
 * Liefert { site, species, birds, regions, errors, warnings }:
 *   species  Map Tiergruppe (id) → Map Art (id) → Steckbrief
 *   birds    die Steckbriefe der Vögel (Abkürzung für species.get('voegel'))
 *   regions  alle Regionsseiten, je Tiergruppe eine (region.kind, region.path)
 * Jede Meldung: { file, path, line?, message }.
 */
export function loadContent(root, { drafts = false } = {}) {
  const problems = { errors: [], warnings: [] };
  const locators = new Map();
  const contentDir = path.join(root, 'content');

  const siteFile = path.join(contentDir, 'site.yml');
  const siteRaw = readYaml(siteFile, problems, locators);
  const site = (siteRaw === undefined ? null : validated(siteRaw, siteSchema, siteFile, problems)) || { title: 'Naturführer' };

  // Arten je Tiergruppe: Meldungen je Art sammeln. Ob sie Fehler bleiben, hängt davon ab,
  // ob die Art in einer veröffentlichten Region vorkommt.
  const species = new Map();
  const perKind = KINDS.map((kind) => {
    const map = new Map();
    const broken = new Set();
    const local = new Map();
    for (const id of listDirs(path.join(contentDir, kind.dir))) {
      const p = { errors: [], warnings: [], templates: [] };
      const sp = loadSpecies(kind, id, path.join(contentDir, kind.dir, id), p, locators);
      local.set(id, p);
      if (sp) map.set(id, sp);
      else broken.add(id);
    }
    species.set(kind.id, map);
    return { kind, species: map, broken, problems: local };
  });

  const loaded = [];
  let regionFailed = false;
  for (const id of listDirs(path.join(contentDir, 'regions'))) {
    const dir = path.join(contentDir, 'regions', id);
    const present = perKind.filter(({ kind }) => fs.existsSync(path.join(dir, kind.guideFile)));
    if (!present.length) {
      const files = KINDS.map((k) => k.guideFile).join(', ');
      problems.errors.push({ file: dir, path: '', message: `Der Ordner enthält keine Regionsdatei (${files}). Lege eine an mit „npm run neue-region -- <name>“.` });
      regionFailed = true;
      continue;
    }
    for (const entry of present) {
      const { kind } = entry;
      const file = path.join(dir, kind.guideFile);
      const local = { errors: [], warnings: [], templates: [] };
      const others = perKind.filter((o) => o !== entry);
      const region = loadGuide(kind, id, dir, entry.species, others, local, entry.broken, locators);
      const isDraft = region ? !!region.draft : isDraftFile(file);
      if (!region) regionFailed = true;
      // Fehler in Entwürfen blockieren die Veröffentlichung der übrigen Regionen nicht
      if (isDraft && !drafts) {
        for (const e of [...local.errors, ...local.templates]) problems.warnings.push({ ...e, message: DRAFT_PREFIX + e.message });
      } else {
        problems.errors.push(...local.errors);
        problems.warnings.push(...local.warnings);
        // Vorlagentexte in Entwürfen sind in der Vorschau nur Hinweise
        (isDraft ? problems.warnings : problems.errors).push(...local.templates);
      }
      const refs = region ? (region[kind.key] || []).filter(Boolean).map((b) => b.id) : tolerantRefs(file, kind.key);
      loaded.push({ kind, region, isDraft, refs });
    }
  }

  // Meldungen der Arten einsortieren
  for (const { kind, species: map, problems: local } of perKind) {
    const usedBuilt = new Set(); // in einer Region, die gebaut wird
    const usedLive = new Set(); // in einer Region, die veröffentlicht wird (kein Entwurf)
    const usedAny = new Set();
    for (const l of loaded) {
      if (l.kind !== kind) continue;
      for (const r of l.refs) {
        usedAny.add(r);
        if (!l.isDraft || drafts) usedBuilt.add(r);
        if (!l.isDraft) usedLive.add(r);
      }
    }
    for (const [id, p] of local) {
      const draftOnly = usedAny.has(id) && !usedBuilt.has(id);
      if (draftOnly) {
        for (const e of [...p.errors, ...p.templates]) problems.warnings.push({ ...e, message: DRAFT_PREFIX + e.message });
      } else {
        problems.errors.push(...p.errors);
        problems.warnings.push(...p.warnings);
        (usedLive.has(id) ? problems.errors : problems.warnings).push(...p.templates);
      }
      if (!usedAny.has(id) && !regionFailed && map.has(id)) {
        problems.warnings.push({ file: path.join(contentDir, kind.dir, id), path: '', message: 'Art wird in keiner Region verwendet' });
      }
    }
  }

  const order = (k) => KINDS.indexOf(k);
  const regions = loaded.filter((l) => l.region && (drafts || !l.region.draft)).map((l) => l.region);
  regions.sort((a, b) => order(a.kind) - order(b.kind) || (a.order ?? 1e9) - (b.order ?? 1e9) || a.title.localeCompare(b.title, 'de'));
  if (!regions.length && !problems.errors.length) {
    problems.errors.push({
      file: path.join(contentDir, 'regions'),
      path: '',
      message: loaded.length
        ? 'Keine veröffentlichte Region: Alle Regionen haben draft: true.'
        : 'Keine Region gefunden. Lege eine an mit „npm run neue-region -- <name>“.',
    });
  }

  const finish = (p) => {
    const line = p.line ?? (locators.has(p.file) ? locators.get(p.file)(p.path) : null);
    return { ...p, file: path.relative(root, path.resolve(root, p.file)), ...(line ? { line } : {}) };
  };
  return {
    site,
    species,
    birds: species.get(DEFAULT_KIND.id),
    regions,
    errors: problems.errors.map(finish),
    warnings: problems.warnings.map(finish),
  };
}
