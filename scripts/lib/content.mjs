// Lädt alle Inhalte aus content/, prüft sie und bereitet sie für die Seiten auf.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { check, siteSchema, birdSchema, regionSchema } from './schema.mjs';
import { prepareSvg, svgLabel, addPins, sanitizeSvgFile } from './svg.mjs';
import { parseMonths, suggest, numberWord, plural } from './text.mjs';
import { parseColor, parseLength, lengthLabel, siteSlugs, siteNeighbours } from './finder.mjs';

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
export const PHOTO_SOURCE_FILE = '.photo-source';
export const ILLUSTRATION_FILE = 'illustration.svg';
export const ILLUSTRATION_SOURCE_FILE = '.illustration-source';
// Größer als nötig für eine Grafik; solche Dateien bremsen die Seite
const ILLUSTRATION_WARN_BYTES = 1024 * 1024;

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

function yamlHint(code) {
  switch (code) {
    case 'TAB_AS_INDENT':
      return ' – Bitte nur Leerzeichen zum Einrücken verwenden, keine Tabulatoren.';
    case 'DUPLICATE_KEY':
      return ' – Ein Feld steht doppelt im selben Block.';
    case 'BAD_INDENT':
    case 'MISSING_CHAR':
    case 'BLOCK_AS_IMPLICIT_KEY':
    case 'MULTILINE_IMPLICIT_KEY':
    case 'UNEXPECTED_TOKEN':
      return ' – Einrückung prüfen. Enthält ein Text „: “, ihn in Anführungszeichen setzen oder als Block mit >- schreiben.';
    default:
      return '';
  }
}

function readYaml(file, problems) {
  const rel = file;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    problems.errors.push({ file: rel, path: '', message: `Datei fehlt oder ist nicht lesbar (${e.code || e.message})` });
    return undefined;
  }
  const doc = YAML.parseDocument(text, { prettyErrors: true, uniqueKeys: true });
  if (doc.errors.length) {
    // Nur den ersten Fehler melden: Weitere sind meist Folgefehler derselben Stelle.
    for (const err of doc.errors.slice(0, 1)) {
      const pos = err.linePos?.[0];
      problems.errors.push({
        file: rel,
        path: pos ? `Zeile ${pos.line}, Spalte ${pos.col}` : '',
        message: `YAML-Fehler: ${err.message.split('\n')[0]}${yamlHint(err.code)}`,
      });
    }
    return undefined;
  }
  const value = doc.toJS();
  for (const w of doc.warnings) problems.warnings.push({ file: rel, path: '', message: `YAML: ${w.message.split('\n')[0]}` });
  return value ?? {};
}

function validated(value, schema, file, problems) {
  const errors = [];
  const out = check(value, schema, '', errors);
  for (const e of errors) problems.errors.push({ file, path: e.path, message: e.message });
  return out;
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

function findPhoto(dir) {
  for (const ext of PHOTO_EXTENSIONS) {
    const f = path.join(dir, 'photo' + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
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

function loadBird(id, dir, problems) {
  const file = path.join(dir, 'bird.yml');
  if (!ID_PATTERN.test(id)) {
    problems.errors.push({ file: dir, path: '', message: `Ordnername „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben a–z, Ziffern und Bindestriche (ä → ae, ö → oe, ü → ue, ß → ss).` });
  }
  const raw = readYaml(file, problems);
  if (raw === undefined) return null;
  const data = validated(raw, birdSchema, file, problems);
  if (!data || !data.name || !data.scientific) return null;

  const bird = { id, dir, file, ...data };
  if (!bird.english) problems.warnings.push({ file, path: 'english', message: 'Englischer Name fehlt (wird für die xeno-canto-Suche genutzt)' });
  if (!bird.marks?.length) problems.warnings.push({ file, path: 'marks', message: 'Keine Merkmale angegeben' });

  // Körperlänge und Farben für „Vogel gesehen?“
  if (bird.length !== undefined) {
    try {
      bird.len = parseLength(bird.length);
    } catch (e) {
      problems.errors.push({ file, path: 'length', message: e.message });
    }
  } else {
    problems.warnings.push({ file, path: 'length', message: 'Körperlänge fehlt (z. B. length: 23); bei „Vogel gesehen?“ zählt die Größe dann nicht' });
  }
  bird.sizeLabel = bird.size || (bird.len ? lengthLabel(bird.len) : null);
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
    problems.warnings.push({ file, path: 'colors', message: 'Farben fehlen (z. B. colors: [grün, gelb]); bei „Vogel gesehen?“ zählen die Farben dann nicht' });
  }

  if (bird.photo) {
    const p = bird.photo;
    mediaSource(p, bird, file, 'photo', problems);
    p.local = findPhoto(dir);
    // „npm run fotos“ merkt sich, zu welcher Commons-Datei das Foto gehört.
    // Passt das nicht mehr zu bird.yml, wird das alte Foto nicht angezeigt.
    if (p.local && isStale(p, path.join(dir, PHOTO_SOURCE_FILE), file, 'photo', 'Das gespeicherte Foto', 'npm run fotos', problems)) {
      p.local = null;
      p.stale = true;
    }
  } else if (findPhoto(dir)) {
    problems.warnings.push({ file, path: 'photo', message: 'Es liegt eine Fotodatei im Ordner, aber ohne Angaben zu Urheber und Lizenz. Sie wird nicht angezeigt.' });
  }

  // Illustration: frei lizenzierte SVG-Grafik, die im Repository liegt
  const illustrationFile = path.join(dir, ILLUSTRATION_FILE);
  const hasIllustration = fs.existsSync(illustrationFile);
  if (bird.illustration) {
    const il = bird.illustration;
    mediaSource(il, bird, file, 'illustration', problems);
    if (il.license && !/^(CC|public domain|gemeinfrei|PD)\b/i.test(il.license.trim())) {
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
    problems.warnings.push({ file, path: 'illustration', message: `Es liegt eine ${ILLUSTRATION_FILE} im Ordner, aber ohne Angaben zu Urheber und Lizenz (illustration in bird.yml). Sie wird nicht angezeigt.` });
  }

  // Zeichnung
  const plateFile = path.join(dir, 'plate.svg');
  bird.plate = null;
  if (fs.existsSync(plateFile)) {
    try {
      const src = fs.readFileSync(plateFile, 'utf8');
      const label = svgLabel(src) || `Schematische Zeichnung: ${bird.title || bird.name}`;
      const prepared = prepareSvg(src, { prefix: id, className: 'plate', label });
      for (const w of prepared.warnings) problems.warnings.push({ file: plateFile, path: '', message: w });
      bird.plate = prepared;
      const n = bird.marks?.length || 0;
      if (prepared.markers && n && prepared.markers !== n) {
        problems.warnings.push({ file: plateFile, path: '', message: `Zeichnung hat ${prepared.markers} Nummern-Markierungen, bird.yml aber ${n} Merkmale` });
      }
    } catch (e) {
      problems.errors.push({ file: plateFile, path: '', message: e.message });
    }
  } else {
    problems.warnings.push({ file: dir, path: '', message: 'Noch keine Zeichnung (plate.svg); es wird ein Platzhalter angezeigt' });
  }
  return bird;
}

function loadRegion(id, dir, birds, problems, broken = new Set()) {
  const file = path.join(dir, 'region.yml');
  if (!ID_PATTERN.test(id)) {
    problems.errors.push({ file: dir, path: '', message: `Ordnername „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben a–z, Ziffern und Bindestriche.` });
  }
  const raw = readYaml(file, problems);
  if (raw === undefined) return null;
  const data = validated(raw, regionSchema, file, problems);
  if (!data || !data.name || !data.title) return null;
  const region = { id, dir, file, ...data };

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

  // Arten
  const seen = new Set();
  region.entries = [];
  (region.birds || []).forEach((entry, i) => {
    if (!entry || !entry.id) return;
    const at = `birds[${i}]`;
    const bird = birds.get(entry.id);
    if (!bird && broken.has(entry.id)) {
      // Steckbrief hat selbst Fehler (oben gemeldet); keine Folgefehler erzeugen
      region.hasBroken = true;
      return;
    }
    if (!bird) {
      const s = suggest(entry.id, [...birds.keys()]);
      problems.errors.push({
        file,
        path: `${at}.id`,
        message: `Art „${entry.id}“ gibt es nicht unter content/birds/.` + (s ? ` Meintest du „${s}“?` : ' Lege sie mit „npm run neue-art -- ' + entry.id + '“ an.'),
      });
      return;
    }
    if (seen.has(entry.id)) {
      problems.errors.push({ file, path: `${at}.id`, message: `Art „${entry.id}“ steht doppelt in der Liste` });
      return;
    }
    seen.add(entry.id);
    if (groups.length) {
      if (!entry.group) {
        problems.errors.push({ file, path: `${at}.group`, message: `Gruppe fehlt. Erlaubt: ${[...groupIds].join(', ')}` });
      } else if (!groupIds.has(entry.group)) {
        const s = suggest(entry.group, [...groupIds]);
        problems.errors.push({ file, path: `${at}.group`, message: `Gruppe „${entry.group}“ ist oben unter groups nicht definiert.` + (s ? ` Meintest du „${s}“?` : ` Erlaubt: ${[...groupIds].join(', ')}`) });
      }
    } else if (entry.group) {
      problems.warnings.push({ file, path: `${at}.group`, message: 'Gruppe angegeben, aber die Region hat keine groups; der Filter entfällt' });
    }
    let monthSet = null;
    if (entry.months !== undefined) {
      try {
        monthSet = parseMonths(entry.months);
      } catch (e) {
        problems.errors.push({ file, path: `${at}.months`, message: e.message });
      }
    }
    region.entries.push({ ...entry, bird, monthSet });
  });
  if (!region.entries.length && !region.hasBroken) problems.errors.push({ file, path: 'birds', message: 'Die Region braucht mindestens eine Art' });
  for (const g of groups) {
    if (g.id && !region.entries.some((e) => e.group === g.id)) {
      problems.warnings.push({ file, path: 'groups', message: `Gruppe „${g.id}“ hat keine Arten und wird nicht angezeigt` });
    }
  }

  // Karte & Orte
  const mapFile = path.join(dir, 'map.svg');
  const sites = (region.places?.sites || []).filter(Boolean);
  region.sites = sites;
  sites.forEach((site, i) => {
    (site.birds || []).forEach((bid, j) => {
      if (!seen.has(bid)) {
        const s = suggest(bid, [...seen]);
        problems.errors.push({
          file,
          path: `places.sites[${i}].birds[${j}]`,
          message: `„${bid}“ ist keine Art dieser Region (Liste birds oben).` + (s ? ` Meintest du „${s}“?` : ''),
        });
      }
    });
    if (site.pin && (site.pin.length !== 2 || site.pin.some((v) => typeof v !== 'number'))) {
      problems.errors.push({ file, path: `places.sites[${i}].pin`, message: 'pin braucht genau zwei Zahlen: [x, y]' });
      site.pin = undefined;
    }
  });
  // Angrenzende Orte (für „Vogel gesehen?“)
  siteSlugs(sites).forEach((slug, i) => {
    sites[i].slug = slug;
  });
  const key = (name) => String(name ?? '').trim().toLowerCase();
  sites.forEach((site, i) => {
    if (!site.near) return;
    site.nearIdx = [];
    site.near.forEach((name, j) => {
      const k = sites.findIndex((o) => key(o.name) === key(name));
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
    e.siteIdx = sites.map((s, i) => ((s.birds || []).includes(e.id) ? i : -1)).filter((i) => i >= 0);
  }

  region.map = null;
  if (fs.existsSync(mapFile)) {
    try {
      const src = fs.readFileSync(mapFile, 'utf8');
      const base = region.places?.map_label || svgLabel(src) || `Schematische Karte: ${region.name}`;
      const pins = sites.map((s, i) => (s.pin ? { n: i + 1, x: s.pin[0], y: s.pin[1] } : null)).filter(Boolean);
      const label = pins.length
        ? `${base} mit ${numberWord(pins.length, { one: 'einem' })} ${plural(pins.length, 'Beobachtungsort', 'Beobachtungsorten')}`
        : base;
      const prepared = prepareSvg(src, { prefix: `map-${id}`, className: 'map', label });
      for (const w of prepared.warnings) problems.warnings.push({ file: mapFile, path: '', message: w });
      region.map = { svg: addPins(prepared.svg, pins), label, pins: pins.length };
      sites.forEach((s, i) => {
        if (!s.pin) problems.warnings.push({ file, path: `places.sites[${i}].pin`, message: `Ort „${s.name}“ hat keine Position auf der Karte (pin: [x, y])` });
      });
    } catch (e) {
      problems.errors.push({ file: mapFile, path: '', message: e.message });
    }
  } else if (sites.some((s) => s.pin)) {
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
 * Lädt alles. `drafts`: Regionen mit draft: true mitbauen.
 * Liefert { site, birds, regions, errors, warnings }.
 */
export function loadContent(root, { drafts = false } = {}) {
  const problems = { errors: [], warnings: [] };
  const contentDir = path.join(root, 'content');
  const rel = (p) => path.relative(root, p);

  const siteRaw = readYaml(path.join(contentDir, 'site.yml'), problems);
  const site = siteRaw === undefined ? { title: 'Vogelführer' } : validated(siteRaw, siteSchema, path.join(contentDir, 'site.yml'), problems) || { title: 'Vogelführer' };

  const birds = new Map();
  const broken = new Set();
  for (const id of listDirs(path.join(contentDir, 'birds'))) {
    const bird = loadBird(id, path.join(contentDir, 'birds', id), problems);
    if (bird) birds.set(id, bird);
    else broken.add(id);
  }

  const loaded = [];
  for (const id of listDirs(path.join(contentDir, 'regions'))) {
    const dir = path.join(contentDir, 'regions', id);
    // Probleme jeder Region zuerst sammeln: Bei Entwürfen, die nicht gebaut werden,
    // sollen Fehler die Veröffentlichung der übrigen Regionen nicht blockieren.
    const local = { errors: [], warnings: [] };
    const region = loadRegion(id, dir, birds, local, broken);
    let isDraft = region ? !!region.draft : false;
    if (!region) {
      try {
        isDraft = /^draft:\s*true\s*(#.*)?$/m.test(fs.readFileSync(path.join(dir, 'region.yml'), 'utf8'));
      } catch {
        isDraft = false;
      }
    }
    if (isDraft && !drafts) {
      for (const e of local.errors) problems.warnings.push({ ...e, message: `(Entwurf, wird nicht veröffentlicht) ${e.message}` });
    } else {
      problems.errors.push(...local.errors);
      problems.warnings.push(...local.warnings);
    }
    if (region) loaded.push(region);
  }
  const regions = loaded.filter((r) => drafts || !r.draft);
  regions.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.title.localeCompare(b.title, 'de'));
  if (!regions.length && !problems.errors.length) {
    problems.errors.push({
      file: 'content/regions',
      path: '',
      message: loaded.length
        ? 'Keine veröffentlichte Region: Alle Regionen haben draft: true.'
        : 'Keine Region gefunden. Lege eine an mit „npm run neue-region -- <name>“.',
    });
  }

  const used = new Set(loaded.flatMap((r) => r.entries.map((e) => e.id)));
  for (const id of birds.keys()) {
    if (!used.has(id)) problems.warnings.push({ file: `content/birds/${id}`, path: '', message: 'Art wird in keiner Region verwendet' });
  }

  const fix = (p) => ({ ...p, file: rel(path.resolve(root, p.file)) });
  return {
    site,
    birds,
    regions,
    errors: problems.errors.map(fix),
    warnings: problems.warnings.map(fix),
  };
}
