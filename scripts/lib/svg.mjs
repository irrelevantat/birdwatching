// SVG-Dateien (Zeichnungen, Karten) für das Einbetten in HTML vorbereiten.

import { esc } from './text.mjs';

// Start-Tag mit Attributen, auch wenn Attributwerte ein „>“ enthalten
const ROOT_RE = /^<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/i;
const TAG_RE = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Erlaubte Elemente: reine Vektorgrafik. Alles andere (a, image, script, style-fremde
// HTML-Elemente, Animationen wie set/animate, foreignObject …) bricht den Build ab.
const ALLOWED_ELEMENTS = new Set(
  [
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'textPath', 'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient',
    'stop', 'use', 'title', 'desc', 'symbol', 'pattern', 'marker', 'style', 'switch',
    'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feComposite', 'feFlood',
    'feMerge', 'feMergeNode', 'feMorphology', 'feDropShadow', 'feComponentTransfer', 'feFuncA',
    'feFuncR', 'feFuncG', 'feFuncB',
  ].map((n) => n.toLowerCase()),
);
const NAMED_ENTITIES = { colon: ':', tab: '\t', newline: '\n', num: '#', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', lpar: '(', rpar: ')', sol: '/', period: '.' };
const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Zeichenreferenzen (&#106; &#x61; &colon; …) auflösen; unbekannte bleiben stehen. */
export function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITIES[n.toLowerCase()] ?? m);
}

/** url(…)-Ziele, die nicht auf eine id im selben Bild zeigen. */
function externalUrl(value) {
  for (const m of decodeEntities(value).matchAll(/url\(\s*(['"]?)\s*([^)'"]*)\1\s*\)/gi)) {
    if (!m[2].replace(/[\u0000- ]/g, '').startsWith('#')) return m[0];
  }
  return null;
}

function reject(what, svg, index) {
  throw new Error(`SVG enthält ${what} (Zeile ${lineAt(svg, index)}). Erlaubt ist nur reine Vektorgrafik.`);
}

/**
 * Prüft Elemente und Attribute gegen die Positivliste und dass alle Elemente
 * geschlossen sind. Wirft einen Fehler mit Zeilennummer.
 * `scan`: Quelltext, in dem Kommentare und CDATA bereits durch Leerzeilen ersetzt sind.
 */
export function checkSvg(scan) {
  const stack = [];
  let last = 0;
  const gapCheck = (from, to) => {
    const lt = scan.slice(from, to).indexOf('<');
    if (lt >= 0) throw new Error(`Ungültiges SVG: Das Element in Zeile ${lineAt(scan, from + lt)} ist nicht vollständig (fehlt ein Anführungszeichen oder ein „>“?)`);
  };
  for (const m of scan.matchAll(new RegExp(TAG_RE.source, 'g'))) {
    gapCheck(last, m.index);
    last = m.index + m[0].length;
    const [, closing, name, attrs, selfClosing] = m;
    if (/=\s*(["'])[^"']*</.test(attrs)) {
      throw new Error(`Ungültiges SVG: In Zeile ${lineAt(scan, m.index)} fehlt ein schließendes Anführungszeichen`);
    }
    if (!closing) {
      if (!ALLOWED_ELEMENTS.has(name.toLowerCase())) reject(`das Element <${name}>`, scan, m.index);
      for (const a of attrs.matchAll(ATTR_RE)) {
        const attr = a[1].toLowerCase();
        const value = a[2] ?? a[3] ?? a[4] ?? '';
        if (/^on/.test(attr) || attr === 'srcdoc' || attr === 'formaction') reject(`das Attribut ${a[1]}`, scan, m.index);
        if (attr === 'href' || attr.endsWith(':href')) {
          const target = decodeEntities(value).replace(/[\u0000- ]/g, '');
          if (!target.startsWith('#') || /&[a-z0-9#]+;/i.test(target)) reject(`einen Link auf „${value.slice(0, 40)}“ (nur #id im selben Bild ist erlaubt)`, scan, m.index);
        }
        const ext = externalUrl(value);
        if (ext) reject(`einen Verweis auf eine externe Datei (${ext.slice(0, 40)})`, scan, m.index);
      }
    }
    if (selfClosing) continue;
    if (!closing) {
      stack.push({ name, index: m.index });
      continue;
    }
    const top = stack.pop();
    if (!top) throw new Error(`Ungültiges SVG: </${name}> (Zeile ${lineAt(scan, m.index)}) schließt nichts`);
    if (top.name !== name) {
      throw new Error(`Ungültiges SVG: <${top.name}> (Zeile ${lineAt(scan, top.index)}) wird nicht geschlossen, stattdessen kommt </${name}> (Zeile ${lineAt(scan, m.index)})`);
    }
  }
  gapCheck(last, scan.length);
  if (stack.length) {
    const top = stack[stack.length - 1];
    throw new Error(`Ungültiges SVG: <${top.name}> (Zeile ${lineAt(scan, top.index)}) wird nicht geschlossen`);
  }
}

/**
 * Bereinigt eine SVG-Datei und macht sie einbettbar:
 *  - entfernt XML-Deklaration, DOCTYPE, Kommentare, Editor-Elemente (Inkscape, Metadaten)
 *  - erlaubt nur Elemente und Attribute reiner Vektorgrafik (Positivliste); Skripte,
 *    Links, Animationen, eingebettete HTML-Inhalte und externe Dateien brechen ab
 *  - prüft, dass alle Elemente geschlossen sind
 *  - stellt allen id-Werten ein Präfix voran (keine Kollisionen zwischen Zeichnungen)
 *  - setzt class, role und aria-label am <svg>-Element
 *
 * Liefert { svg, warnings, markers } oder wirft einen Fehler mit verständlicher Meldung.
 */
export function prepareSvg(source, { prefix, className, label }) {
  const warnings = [];
  const original = String(source).replace(/^﻿/, '');
  // Entfernte Teile durch gleich viele Zeilenumbrüche ersetzen, damit Zeilennummern stimmen
  const keepLines = (m) => m.replace(/[^\n]/g, '');
  let svg = original
    .replace(/<!--[\s\S]*?-->/g, keepLines)
    .replace(/<\?[\s\S]*?\?>/g, keepLines)
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, keepLines)
    .replace(/<metadata\b[\s\S]*?<\/metadata>/gi, keepLines)
    .replace(/<(sodipodi|inkscape):[\w.-]+\b(?:[^>"']|"[^"]*"|'[^']*')*?\/>/gi, keepLines)
    .replace(/<(sodipodi|inkscape):([\w.-]+)\b[\s\S]*?<\/\1:\2>/gi, keepLines);

  // CDATA bleibt im Ergebnis (z. B. in <style>), wird für die Struktur-Prüfung aber ausgeblendet
  const scan = svg.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, keepLines);
  if (!/^\s*<svg\b/i.test(scan) || !/<\/svg>\s*$/i.test(scan)) {
    throw new Error('Datei beginnt nicht mit <svg …> oder endet nicht mit </svg>');
  }
  checkSvg(scan);
  for (const m of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = decodeEntities(m[1]);
    if (/@import|expression\s*\(|javascript:|behaviou?r\s*:/i.test(css)) reject('in <style> einen @import oder Skriptverweis', svg, m.index);
    const ext = externalUrl(css);
    if (ext) reject(`in <style> einen Verweis auf eine externe Datei (${ext.slice(0, 40)})`, svg, m.index);
  }
  svg = svg.trim();

  const open = ROOT_RE.exec(svg);
  if (!open || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error('Datei beginnt nicht mit <svg …> oder endet nicht mit </svg>');
  }

  if (/<style\b/i.test(svg)) {
    warnings.push('enthält <style>. Diese Regeln gelten auf der ganzen Seite und können andere Zeichnungen verändern. Besser Farben direkt als Attribute (fill="…") speichern.');
  }

  // ids mit Präfix versehen („--“ trennt eindeutig: Art „a“ + id „b-c“ ≠ Art „a-b“ + id „c“)
  const ids = new Set([...svg.matchAll(/\sid\s*=\s*(["'])([^"']+)\1/g)].map((m) => m[2]));
  if (ids.size) {
    const pre = (id) => `${prefix}--${id}`;
    svg = svg
      .replace(/(\sid\s*=\s*)(["'])([^"']+)\2/g, (m, a, q, id) => (ids.has(id) ? `${a}${q}${pre(id)}${q}` : m))
      .replace(/url\(\s*(['"]|&quot;)?#([^'")\s&]+)\1?\s*\)/g, (m, q, id) => (ids.has(id) ? `url(#${pre(id)})` : m))
      .replace(/((?:xlink:)?href\s*=\s*)(["'])#([^"']+)\2/g, (m, a, q, id) => (ids.has(id) ? `${a}${q}#${pre(id)}${q}` : m))
      .replace(/(aria-(?:labelledby|describedby)\s*=\s*)(["'])([^"']+)\2/g, (m, a, q, list) =>
        `${a}${q}${list.split(/\s+/).map((id) => (ids.has(id) ? pre(id) : id)).join(' ')}${q}`,
      );
  }

  // Root-Element anpassen
  svg = svg.replace(ROOT_RE, (m, attrs) => {
    let a = attrs;
    const cls = /\sclass\s*=\s*(["'])(.*?)\1/.exec(a);
    if (cls) a = a.replace(cls[0], () => ` class="${[className, cls[2].trim()].filter(Boolean).join(' ')}"`);
    else a = ` class="${className}"` + a;
    if (!/\srole\s*=/.test(a)) a += ' role="img"';
    if (label !== undefined) {
      const lab = /\saria-label\s*=\s*(["'])(.*?)\1/.exec(a);
      if (lab) a = a.replace(lab[0], () => ` aria-label="${esc(label)}"`);
      else a += ` aria-label="${esc(label)}"`;
    }
    return `<svg${a}>`;
  });

  if (!/\sviewBox\s*=/.test(ROOT_RE.exec(svg)[0])) {
    warnings.push('hat kein viewBox-Attribut und skaliert deshalb nicht mit der Kartenbreite');
  }

  const markers = (svg.match(/class\s*=\s*["'](?:[^"']*\s)?mk(?:\s[^"']*)?["']/g) || []).length;
  return { svg, warnings, markers };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const UNSAFE = /<script\b|<foreignObject\b|javascript:|\son[a-z]+\s*=/i;

/**
 * Bereitet eine fremde SVG-Datei (z. B. eine CC-Illustration von Wikimedia Commons)
 * für die Website vor. Sie wird nicht in die Seite eingebettet, sondern als eigene
 * Datei über <img> angezeigt; ihre Stile und ids wirken dadurch nicht auf die Seite.
 * Entfernt trotzdem alles Ausführbare, falls jemand die Datei direkt öffnet, und
 * ergänzt den SVG-Namensraum, ohne den Browser sie in <img> nicht anzeigen.
 *
 * Liefert { svg, warnings } oder wirft einen Fehler.
 */
export function sanitizeSvgFile(source) {
  const warnings = [];
  let svg = String(source).replace(/^﻿/, '');
  const open = /<svg\b[^>]*>/i.exec(svg);
  // Leerraum im End-Tag ist erlaubt (Inkscape schreibt z. B. „</svg\n>“)
  if (!open || !/<\/svg\s*>\s*$/i.test(svg)) throw new Error('Keine gültige SVG-Datei (<svg …> … </svg> fehlt)');
  if (UNSAFE.test(svg)) {
    warnings.push('enthält Skripte, eingebettetes HTML oder Event-Handler; wurden entfernt');
    svg = svg
      .replace(/<(script|foreignObject)\b[^>]*\/>/gi, '')
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/(\s(?:xlink:)?href\s*=\s*)("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1"#"');
    if (UNSAFE.test(svg)) throw new Error('enthält Skripte, die sich nicht sicher entfernen lassen');
  }
  const root = /<svg\b[^>]*>/i.exec(svg);
  if (!/\sxmlns\s*=/.test(root[0])) {
    svg = svg.slice(0, root.index) + root[0].replace(/^<svg\b/i, `<svg xmlns="${SVG_NS}"`) + svg.slice(root.index + root[0].length);
  }
  if (!/\sviewBox\s*=/.test(root[0]) && !(/\swidth\s*=/.test(root[0]) && /\sheight\s*=/.test(root[0]))) {
    warnings.push('hat weder viewBox noch width und height und wird deshalb eventuell nicht richtig skaliert');
  }
  return { svg, warnings };
}

/** Liest das aria-label einer SVG-Datei (oder null). */
export function svgLabel(source) {
  const open = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(String(source));
  if (!open) return null;
  const m = /\saria-label\s*=\s*(["'])(.*?)\1/.exec(open[0]);
  return m ? m[2].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : null;
}

/**
 * Fügt nummerierte Markierungen (Orte) in eine Karte ein. Mit `href` (und `label`)
 * wird eine Markierung zum Link, z. B. auf die Beschreibung des Ortes.
 */
export function addPins(svg, pins) {
  const marks = pins
    .map(({ n, x, y, href, label }) => {
      const cx = Math.round(x * 10) / 10;
      const cy = Math.round(y * 10) / 10;
      const ty = Math.round((cy + 4.2) * 10) / 10;
      const pin = `<circle cx="${cx}" cy="${cy}" r="10.5" fill="#0b7f86" stroke="#ffffff" stroke-width="2"/><text x="${cx}" y="${ty}" text-anchor="middle" class="t-pin">${n}</text>`;
      return href ? `<a href="${esc(href)}" class="pin"${label ? ` aria-label="${esc(label)}"` : ''}>${pin}</a>` : pin;
    })
    .join('');
  return svg.replace(/<\/svg>\s*$/i, () => `${marks}</svg>`);
}

/** Ersatzbild, solange es für eine Art noch keine Zeichnung gibt. */
export function placeholderPlate(name) {
  return `<svg class="plate" viewBox="0 0 320 240" role="img" aria-label="${esc(`Noch keine Zeichnung: ${name}`)}" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="#efe6d2"/><path d="M112 150 C118 118 150 100 178 108 C196 92 222 92 232 104 C222 106 214 112 210 120 C214 140 200 162 172 168 L118 196 L126 168 C116 166 110 160 112 150 Z" fill="#d8cdb4"/><circle cx="214" cy="106" r="3" fill="#b5a888"/><text x="160" y="222" text-anchor="middle" font-size="13" font-weight="700" fill="#5f5540">Zeichnung folgt</text></svg>`;
}
