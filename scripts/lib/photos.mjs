// Fotos und Illustrationen (SVG) von Wikimedia Commons herunterladen
// (verwendet von scripts/fetch-photos.mjs und scripts/fetch-illustrations.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { loadContent, PHOTO_EXTENSIONS, PHOTO_SOURCE_FILE, ILLUSTRATION_FILE, ILLUSTRATION_SOURCE_FILE } from './content.mjs';
import { sanitizeSvgFile } from './svg.mjs';

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

function removeOldPhotos(dir) {
  for (const ext of PHOTO_EXTENSIONS) {
    const f = path.join(dir, 'photo' + ext);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

const KINDS = {
  // Fotos werden verkleinert (960 px, eine Standard-Vorschaugröße von Wikimedia)
  photo: {
    field: 'photo',
    base: 'photo',
    marker: PHOTO_SOURCE_FILE,
    width: 960,
    maxBytes: 8 * 1024 * 1024,
    exts: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' },
    one: 'Foto',
    many: 'Fotos',
    command: 'npm run fotos',
    remove: removeOldPhotos,
    prepare: (buf) => buf,
  },
  // Illustrationen als Original-SVG, bereinigt; sie werden im Repository gespeichert
  illustration: {
    field: 'illustration',
    base: 'illustration',
    marker: ILLUSTRATION_SOURCE_FILE,
    width: null,
    maxBytes: 2 * 1024 * 1024,
    exts: { 'image/svg+xml': '.svg' },
    one: 'Grafik',
    many: 'Grafiken',
    command: 'npm run grafiken',
    remove: (dir) => fs.rmSync(path.join(dir, ILLUSTRATION_FILE), { force: true }),
    prepare: (buf) => Buffer.from(sanitizeSvgFile(buf.toString('utf8')).svg),
  },
};
const NETWORK_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'ENETUNREACH']);

export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const norm = (s) => stripHtml(s).toLowerCase().replace(/[\s_-]+/g, ' ').trim();

function isNetworkError(e) {
  const code = e?.cause?.code || e?.code;
  return NETWORK_CODES.has(code) || /fetch failed/i.test(e?.message || '');
}

const MAX_WAIT_MS = 60_000;

async function withRetry(fn, { tries = 5, delay = 5000 } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      // Ohne Netz bringen Wiederholungen nichts
      if (i >= tries || isNetworkError(e) || e.permanent) throw e;
      // Bei „zu viele Anfragen“ (429/503) die vom Server genannte Wartezeit einhalten
      const wait = Math.min(e.retryAfter ?? delay * 2 ** (i - 1), MAX_WAIT_MS);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** Retry-After als Sekunden oder als Datum → Millisekunden. */
export function retryAfterMs(header, now = Date.now()) {
  if (!header) return null;
  const s = Number(header);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const t = Date.parse(header);
  return Number.isNaN(t) ? null : Math.max(0, t - now);
}

function httpError(res) {
  const e = new Error(`HTTP ${res.status}`);
  e.permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408;
  e.retryAfter = retryAfterMs(res.headers.get('retry-after'));
  return e;
}

/** Vergleicht Angaben aus bird.yml mit den Metadaten auf Commons. */
export function compareMetadata(photo, meta = {}) {
  const notes = [];
  const commonsLicense = stripHtml(meta.LicenseShortName?.value);
  if (commonsLicense && norm(commonsLicense) !== norm(photo.license)) {
    notes.push(`Lizenz auf Commons: „${commonsLicense}“, in bird.yml: „${photo.license}“`);
  }
  const artist = stripHtml(meta.Artist?.value);
  if (artist && photo.author && !norm(artist).includes(norm(photo.author)) && !norm(photo.author).includes(norm(artist))) {
    notes.push(`Urheber auf Commons: „${artist}“, in bird.yml: „${photo.author}“`);
  }
  return notes;
}

async function fetchOne(bird, kind, { api, userAgent, delay }) {
  const p = bird[kind.field];
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    ...(kind.width ? { iiurlwidth: String(kind.width) } : {}),
    titles: 'File:' + p.file,
  });
  const data = await withRetry(async () => {
    const res = await fetch(`${api}?${params}`, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
    if (!res.ok) throw httpError(res);
    return res.json();
  }, { delay });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing || page.invalid || !page.imageinfo?.length) {
    return { ok: false, message: `„${p.file}“ gibt es auf Commons nicht (Dateiname prüfen)` };
  }
  const info = page.imageinfo[0];
  if (!kind.exts[info.mime]) {
    return { ok: false, message: `„${p.file}“ ist keine passende Datei (${info.mime || 'Typ unbekannt'}; erwartet ${Object.keys(kind.exts).join(', ')})` };
  }
  const notes = compareMetadata(p, info.extmetadata);
  const url = kind.width ? info.thumburl || info.url : info.url;
  const { buf, type } = await withRetry(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) throw httpError(res);
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length > kind.maxBytes) {
      const e = new Error(`Datei zu groß (${Math.round(b.length / 1024)} KB)`);
      e.permanent = true;
      throw e;
    }
    return { buf: b, type: (res.headers.get('content-type') || '').split(';')[0].trim() };
  }, { delay });
  const ext = kind.exts[type] || kind.exts[info.mime];
  if (!ext) return { ok: false, message: `unerwartetes Format (${type || info.mime || 'unbekannt'})` };
  let file;
  try {
    file = kind.prepare(buf);
  } catch (e) {
    return { ok: false, message: e.message };
  }
  kind.remove(bird.dir);
  fs.writeFileSync(path.join(bird.dir, kind.base + ext), file);
  fs.writeFileSync(path.join(bird.dir, kind.marker), p.file + '\n');
  return { ok: true, message: `${Math.round(file.length / 1024)} KB`, notes };
}

/**
 * Lädt fehlende (oder mit force: alle) Fotos. Bricht nie mit einem Fehler ab.
 * Liefert { total, loaded, failed, offline }.
 */
export function fetchPhotos(options = {}) {
  return fetchMedia(KINDS.photo, options);
}

/** Wie fetchPhotos, aber für Illustrationen (illustration.svg, bleibt im Repository). */
export function fetchIllustrations(options = {}) {
  return fetchMedia(KINDS.illustration, options);
}

async function fetchMedia(kind, {
  root,
  force = false,
  only = [],
  api = COMMONS_API,
  userAgent = 'vogelfuehrer-site-builder/1.0 (static site build; Node.js)',
  pause = 1000,
  delay = 5000,
  log = console.log,
} = {}) {
  const { birds, errors } = loadContent(root, { drafts: true });
  if (errors.length) log(`Hinweis: Es gibt ${errors.length} Fehler in den Inhalten (npm run build zeigt Details). Fotos werden trotzdem geladen.`);
  const wanted = new Set(only);
  const todo = [...birds.values()].filter((b) => {
    const p = b[kind.field];
    if (wanted.size && !wanted.has(b.id)) return false;
    if (!p?.file) return false;
    return force || !p.local || p.stale;
  });
  const result = { total: todo.length, loaded: 0, failed: 0, offline: false };
  if (!todo.length) {
    log(`Keine ${kind.many} zu laden. (Alle vorhanden? Neu laden mit: ${kind.command} -- --force)`);
    return result;
  }
  log(`Lade ${todo.length} ${todo.length === 1 ? kind.one : kind.many} von Wikimedia Commons …`);
  let networkFailures = 0;
  for (const bird of todo) {
    try {
      const r = await fetchOne(bird, kind, { api, userAgent, delay });
      networkFailures = 0;
      if (r.ok) result.loaded++;
      else result.failed++;
      log(`${r.ok ? '✔' : '✖'} ${bird.id}: ${r.message}`);
      for (const n of r.notes || []) log(`  ⚠ ${n}`);
    } catch (e) {
      result.failed++;
      log(`✖ ${bird.id}: ${e.cause?.code || e.message}`);
      if (isNetworkError(e) && ++networkFailures >= 2) {
        result.offline = true;
        log('Wikimedia Commons ist nicht erreichbar (keine Internetverbindung oder gesperrt). Abbruch.');
        break;
      }
    }
    if (pause) await new Promise((r) => setTimeout(r, pause)); // freundlich zu den Servern
  }
  log(`${result.loaded} von ${todo.length} geladen.`);
  if (kind === KINDS.photo && result.loaded < todo.length) {
    log('Nicht geladene Fotos werden auf der Seite nur verlinkt. Der Build läuft trotzdem.');
    // In GitHub Actions als Warnung in der Übersicht des Laufs anzeigen
    if (process.env.GITHUB_ACTIONS === 'true') log(`::warning title=Fotos::${todo.length - result.loaded} von ${todo.length} Fotos konnten nicht geladen werden und werden nur verlinkt.`);
  }
  if (kind === KINDS.illustration && result.loaded) {
    log(`Die Grafiken liegen jetzt als ${ILLUSTRATION_FILE} (mit ${ILLUSTRATION_SOURCE_FILE}) im Ordner der Art. Bitte beide Dateien committen.`);
  }
  return result;
}
