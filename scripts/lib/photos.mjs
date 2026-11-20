// Fotos von Wikimedia Commons herunterladen (verwendet von scripts/fetch-photos.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { loadContent, PHOTO_EXTENSIONS, PHOTO_SOURCE_FILE } from './content.mjs';

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIDTH = 960; // eine der Standard-Vorschaugrößen von Wikimedia
const MAX_BYTES = 8 * 1024 * 1024;
const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
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

function removeOldPhotos(dir) {
  for (const ext of PHOTO_EXTENSIONS) {
    const f = path.join(dir, 'photo' + ext);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

async function fetchOne(bird, { api, userAgent, delay }) {
  const p = bird.photo;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: String(WIDTH),
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
  const notes = compareMetadata(p, info.extmetadata);
  const url = info.thumburl || info.url;
  const { buf, type } = await withRetry(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) throw httpError(res);
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length > MAX_BYTES) {
      const e = new Error(`Datei zu groß (${Math.round(b.length / 1024)} KB)`);
      e.permanent = true;
      throw e;
    }
    return { buf: b, type: (res.headers.get('content-type') || '').split(';')[0].trim() };
  }, { delay });
  const ext = EXT_BY_MIME[type] || EXT_BY_MIME[info.mime];
  if (!ext) return { ok: false, message: `unerwartetes Bildformat (${type || info.mime || 'unbekannt'})` };
  removeOldPhotos(bird.dir);
  fs.writeFileSync(path.join(bird.dir, 'photo' + ext), buf);
  fs.writeFileSync(path.join(bird.dir, PHOTO_SOURCE_FILE), p.file + '\n');
  return { ok: true, message: `${Math.round(buf.length / 1024)} KB`, notes };
}

/**
 * Lädt fehlende (oder mit force: alle) Fotos. Bricht nie mit einem Fehler ab.
 * Liefert { total, loaded, failed, offline }.
 */
export async function fetchPhotos({
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
    if (wanted.size && !wanted.has(b.id)) return false;
    if (!b.photo?.file) return false;
    return force || !b.photo.local || b.photo.stale;
  });
  const result = { total: todo.length, loaded: 0, failed: 0, offline: false };
  if (!todo.length) {
    log('Keine Fotos zu laden. (Alle vorhanden? Neu laden mit: npm run fotos -- --force)');
    return result;
  }
  log(`Lade ${todo.length} ${todo.length === 1 ? 'Foto' : 'Fotos'} von Wikimedia Commons …`);
  let networkFailures = 0;
  for (const bird of todo) {
    try {
      const r = await fetchOne(bird, { api, userAgent, delay });
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
  if (result.loaded < todo.length) {
    log('Nicht geladene Fotos werden auf der Seite nur verlinkt. Der Build läuft trotzdem.');
    // In GitHub Actions als Warnung in der Übersicht des Laufs anzeigen
    if (process.env.GITHUB_ACTIONS === 'true') log(`::warning title=Fotos::${todo.length - result.loaded} von ${todo.length} Fotos konnten nicht geladen werden und werden nur verlinkt.`);
  }
  return result;
}
