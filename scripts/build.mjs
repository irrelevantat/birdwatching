#!/usr/bin/env node
// Baut die Website aus content/ nach _site/.
//
//   npm run build                 normaler Build
//   npm run build -- --drafts     Regionen mit draft: true mitbauen
//   npm run build -- --strict     Warnungen wie Fehler behandeln
//
// Umgebungsvariablen (setzt der GitHub-Pages-Workflow automatisch):
//   SITE_URL   volle Adresse der Website, z. B. https://name.github.io/repo/
//              (für canonical-Links und sitemap.xml)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lib/content.mjs';
import { renderRegionPages, renderIndex, render404 } from './lib/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const color = !process.env.NO_COLOR && (process.env.FORCE_COLOR ? process.env.FORCE_COLOR !== '0' : process.stdout.isTTY);
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint('31', s);
const yellow = (s) => paint('33', s);
const green = (s) => paint('32', s);
const dim = (s) => paint('2', s);

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Der Ausgabeordner wird vor jedem Build gelöscht. Erlaubt ist er nur, wenn er
 * weder das Projekt noch ein übergeordneter Ordner ist und entweder fehlt, leer ist
 * oder von einem früheren Build stammt (erkennbar an .nojekyll).
 */
export function assertSafeOutDir(out, root) {
  // Der Standardordner _site im Projekt darf immer neu angelegt werden (steht in .gitignore)
  if (out === path.join(root, '_site')) return;
  const rel = path.relative(out, root);
  if (out === root || (rel && !rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`Ausgabeordner ${out} ist das Projekt oder ein übergeordneter Ordner; Abbruch.`);
  }
  if (!fs.existsSync(out)) return;
  if (!fs.statSync(out).isDirectory()) throw new Error(`Ausgabeordner ${out} ist eine Datei; Abbruch.`);
  const entries = fs.readdirSync(out);
  if (entries.length && !entries.includes('.nojekyll')) {
    throw new Error(`Ausgabeordner ${out} ist nicht leer und stammt nicht von einem früheren Build; er wird nicht gelöscht. Bitte einen leeren Ordner angeben.`);
  }
}

function normalizeSiteUrl(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^https?:\/\//.test(v)) return null;
  return v.endsWith('/') ? v : v + '/';
}

export function printProblems({ errors, warnings }, log = console.log) {
  const byFile = new Map();
  for (const [kind, list] of [['error', errors], ['warning', warnings]]) {
    for (const p of list) {
      if (!byFile.has(p.file)) byFile.set(p.file, []);
      byFile.get(p.file).push({ kind, ...p });
    }
  }
  for (const [file, list] of byFile) {
    log(dim(file));
    for (const p of list) {
      const mark = p.kind === 'error' ? red('  ✖ Fehler ') : yellow('  ⚠ Hinweis');
      const where = [p.line ? `Zeile ${p.line}` : '', p.path].filter(Boolean).join(' · ');
      log(`${mark} ${where ? where + ': ' : ''}${p.message}`);
    }
  }
}

/**
 * Baut die Website. Liefert { ok, errors, warnings, pages, out }.
 */
export function build({ root = ROOT, out = path.join(root, '_site'), drafts = false, siteUrl = null, log = console.log } = {}) {
  const content = loadContent(root, { drafts });
  const { site, regions, errors, warnings } = content;
  if (errors.length) return { ok: false, errors, warnings, pages: [], out };

  // Ausgabeordner leeren – aber nur, wenn er sicher ein Build-Ordner ist
  const resolvedOut = path.resolve(out);
  assertSafeOutDir(resolvedOut, path.resolve(root));
  fs.rmSync(resolvedOut, { recursive: true, force: true });
  fs.mkdirSync(resolvedOut, { recursive: true });
  // Kennzeichen „von einem Build erzeugt“ sofort schreiben, auch wenn der Build danach abbricht
  fs.writeFileSync(path.join(resolvedOut, '.nojekyll'), '');

  // Assets
  copyDir(path.join(root, 'assets'), path.join(resolvedOut, 'assets'));
  const assets = {
    css: hash(path.join(root, 'assets', 'style.css')),
    js: hash(path.join(root, 'assets', 'guide.js')),
  };

  // Fotos (nur heruntergeladene/abgelegte Dateien; sonst bleibt es beim Link)
  const photos = new Map();
  let declared = 0;
  const usedBirds = new Map();
  for (const r of regions) for (const e of r.entries) usedBirds.set(e.id, e.bird);
  for (const bird of usedBirds.values()) {
    if (!bird.photo) continue;
    declared++;
    if (!bird.photo.local) continue;
    const rel = `photos/${bird.id}${path.extname(bird.photo.local).toLowerCase()}`;
    fs.mkdirSync(path.join(resolvedOut, 'photos'), { recursive: true });
    fs.copyFileSync(bird.photo.local, path.join(resolvedOut, rel));
    photos.set(bird.id, rel);
  }

  // Illustrationen (CC-SVGs aus dem Repository), bereinigt; ?v= damit Browser Änderungen sehen
  const illustrations = new Map();
  for (const bird of usedBirds.values()) {
    const il = bird.illustration;
    if (!il?.svg) continue;
    const rel = `illustrations/${bird.id}.svg`;
    fs.mkdirSync(path.join(resolvedOut, 'illustrations'), { recursive: true });
    fs.writeFileSync(path.join(resolvedOut, rel), il.svg);
    illustrations.set(bird.id, `${rel}?v=${crypto.createHash('sha256').update(il.svg).digest('hex').slice(0, 10)}`);
  }

  const url = normalizeSiteUrl(siteUrl);
  const absBase = url ? new URL(url).pathname : '/';
  const pages = [];
  const write = (rel, html) => {
    const file = path.join(resolvedOut, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    pages.push(rel);
  };

  write('index.html', renderIndex(regions, site, { assets, siteUrl: url }));
  for (const region of regions) {
    for (const p of renderRegionPages(region, site, { assets, photos, illustrations, siteUrl: url })) write(p.path, p.html);
  }
  write('404.html', render404(site, { absBase, assets }));
  if (url) {
    const locs = pages
      .filter((p) => p.endsWith('index.html'))
      .map((p) => p.slice(0, -'index.html'.length))
      .map((p) => `  <url><loc>${url}${p}</loc></url>`)
      .join('\n');
    fs.writeFileSync(path.join(resolvedOut, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</urlset>\n`);
    // robots.txt wirkt nur an der Wurzel einer Domain (nicht bei name.github.io/projekt/)
    if (absBase === '/') fs.writeFileSync(path.join(resolvedOut, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${url}sitemap.xml\n`);
  }

  return { ok: true, errors, warnings, pages, out: resolvedOut, regions, photos, illustrations, declared, birds: usedBirds.size };
}

function isMain() {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] || '');
  } catch {
    return false;
  }
}

// Aufruf von der Kommandozeile
if (isMain()) {
  const args = process.argv.slice(2);
  const known = ['--drafts', '--strict', '--out'];
  const unknown = args.filter((a, i) => a.startsWith('--') && !known.includes(a) && args[i - 1] !== '--out');
  if (unknown.length) {
    console.error(red(`✖ Unbekannte Option ${unknown[0]}. Erlaubt: --drafts, --strict, --out <ordner>`));
    process.exit(1);
  }
  const drafts = args.includes('--drafts');
  const strict = args.includes('--strict');
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('--'))) {
    console.error(red('✖ --out braucht einen Ordner, z. B. --out _site'));
    process.exit(1);
  }
  const out = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(ROOT, '_site');
  const started = Date.now();
  let result;
  try {
    result = build({ out, drafts, siteUrl: process.env.SITE_URL });
  } catch (e) {
    console.error(red(`✖ ${e.message}`));
    process.exit(1);
  }
  printProblems(result);
  if (!result.ok) {
    console.error(red(`\n✖ Build abgebrochen: ${result.errors.length} Fehler. Bitte die oben genannten Stellen korrigieren.`));
    process.exit(1);
  }
  const missing = result.declared - result.photos.size;
  console.log(
    green(`✔ ${result.regions.length} ${result.regions.length === 1 ? 'Region' : 'Regionen'}, ${result.birds} Arten, ${result.pages.length} Seiten`) +
      dim(` → ${path.relative(process.cwd(), result.out) || '.'} (${Date.now() - started} ms)`),
  );
  if (missing > 0) {
    console.log(dim(`ℹ ${missing} von ${result.declared} Fotos liegen nicht lokal vor und werden nur verlinkt. Herunterladen mit: npm run fotos`));
  }
  if (strict && result.warnings.length) {
    console.error(red(`✖ --strict: ${result.warnings.length} Hinweise gelten als Fehler`));
    process.exit(1);
  }
}
