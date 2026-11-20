// Gemeinsame Helfer für „npm run neue-art“ und „npm run neue-region“.

import YAML from 'yaml';
import { ID_PATTERN } from './content.mjs';

/** Macht aus einem Namen einen Ordnernamen: „Grünreiher“ → „gruenreiher“. */
export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Liest „<name> [--flag wert] …“ von der Kommandozeile. */
export function parseArgs(argv, flags) {
  const out = { _: [] };
  let lastOption = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (!flags.includes(key)) {
        throw new Error(flags.length ? `Unbekannte Option ${a}. Erlaubt: ${flags.map((f) => '--' + f).join(', ')}` : `Unbekannte Option ${a}`);
      }
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) throw new Error(`Option ${a} braucht einen Wert`);
      out[key] = val;
      lastOption = a;
      i++;
    } else if (lastOption && out._.length) {
      // z. B. --english Squacco Heron ohne Anführungszeichen
      throw new Error(`„${a}“ nach ${lastOption} ${out[lastOption.slice(2)]}: Mehrere Wörter bitte in Anführungszeichen setzen, z. B. ${lastOption} "${out[lastOption.slice(2)]} ${a}"`);
    } else {
      out._.push(a);
    }
  }
  return out;
}

/** Name und id aus der Eingabe ableiten. */
export function nameAndId(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const id = slugify(raw);
  if (!ID_PATTERN.test(id)) return null;
  // Wer schon einen Ordnernamen angibt („gruenreiher“), bekommt ihn als Namen mit großem Anfangsbuchstaben
  const looksLikeId = ID_PATTERN.test(raw);
  const name = looksLikeId ? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, ' ') : raw;
  return { id, name, guessed: looksLikeId };
}

/** YAML-Wert für eine Zeile wie „name: …“ (bei Bedarf in Anführungszeichen). */
export function yamlScalar(value) {
  const s = String(value);
  if (/^[\p{L}\p{N}][\p{L}\p{N} .,()'’&/-]*$/u.test(s) && !/:\s|\s#/.test(s) && !/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return s;
  return JSON.stringify(s);
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function currentMonth(date = new Date()) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Fügt einen Eintrag am Ende der Liste „birds:“ ein, ohne den Rest der Datei
 * anzufassen. Prüft danach, dass die Datei gültig ist und sich sonst nichts geändert hat.
 */
export function insertBird(text, birdId, lines) {
  const before = YAML.parseDocument(text);
  if (before.errors.length) return { status: 'fail', reason: 'die Datei enthält YAML-Fehler' };
  const data = before.toJS() || {};
  const list = data.birds ?? [];
  if (!Array.isArray(list)) return { status: 'fail', reason: '„birds“ ist keine Liste' };
  if (list.some((b) => b && b.id === birdId)) return { status: 'exists' };

  const src = text.split('\n');
  const start = src.findIndex((l) => /^birds:(\s*(\[\s*\])?)?\s*(#.*)?$/.test(l));
  if (start < 0) return { status: 'fail', reason: 'keine Zeile „birds:“ gefunden' };
  // Ende des Blocks: nächste Zeile auf oberster Ebene (Schlüssel oder Kommentar am Zeilenanfang)
  let end = start + 1;
  while (end < src.length && !/^[^\s#]/.test(src[end]) && !/^#/.test(src[end])) end++;
  // Leerzeilen am Blockende nicht mitzählen
  let insertAt = end;
  while (insertAt > start + 1 && src[insertAt - 1].trim() === '') insertAt--;
  const out = [...src];
  if (/\[\s*\]/.test(src[start])) out[start] = src[start].replace(/\s*\[\s*\]/, '');
  out.splice(insertAt, 0, ...lines);
  const next = out.join('\n');

  const after = YAML.parseDocument(next);
  if (after.errors.length) return { status: 'fail', reason: 'Einfügen hätte die Datei ungültig gemacht' };
  const a = after.toJS() || {};
  const expected = { ...data, birds: [...list, after.toJS().birds?.at(-1)] };
  const same = JSON.stringify(a) === JSON.stringify(expected) && a.birds?.at(-1)?.id === birdId;
  if (!same) return { status: 'fail', reason: 'Einrückung der Liste weicht ab' };
  return { status: 'ok', text: next };
}
