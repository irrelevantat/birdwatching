// SVG-Dateien (Zeichnungen, Karten) für das Einbetten in HTML vorbereiten.

import { esc } from './text.mjs';

// Start-Tag mit Attributen, auch wenn Attributwerte ein „>“ enthalten
const ROOT_RE = /^<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/i;
const TAG_RE = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * Prüft, ob alle Elemente geschlossen werden. Wirft einen Fehler mit Zeilennummer.
 * Kommentare und CDATA müssen vorher entfernt sein.
 */
export function checkBalance(svg, source = svg) {
  const stack = [];
  for (const m of svg.matchAll(TAG_RE)) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (!closing) {
      stack.push({ name, index: m.index });
      continue;
    }
    const top = stack.pop();
    if (!top) throw new Error(`Ungültiges SVG: </${name}> (Zeile ${lineAt(svg, m.index)}) schließt nichts`);
    if (top.name !== name) {
      throw new Error(`Ungültiges SVG: <${top.name}> (Zeile ${lineAt(svg, top.index)}) wird nicht geschlossen, stattdessen kommt </${name}> (Zeile ${lineAt(svg, m.index)})`);
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1];
    throw new Error(`Ungültiges SVG: <${top.name}> (Zeile ${lineAt(svg, top.index)}) wird nicht geschlossen`);
  }
}

/**
 * Bereinigt eine SVG-Datei und macht sie einbettbar:
 *  - entfernt XML-Deklaration, DOCTYPE, Kommentare, Editor-Metadaten
 *  - lehnt aktive Inhalte ab (<script>, Event-Handler, javascript:-Links, <foreignObject>)
 *  - prüft, dass alle Elemente geschlossen sind
 *  - stellt allen id-Werten ein Präfix voran (keine Kollisionen zwischen Zeichnungen)
 *  - setzt class, role und aria-label am <svg>-Element
 *
 * Liefert { svg, warnings, markers } oder wirft einen Fehler mit verständlicher Meldung.
 */
export function prepareSvg(source, { prefix, className, label }) {
  const warnings = [];
  const original = String(source).replace(/^﻿/, '');
  // Kommentare/CDATA zuerst durch gleich viele Zeilenumbrüche ersetzen, damit Zeilennummern stimmen
  const keepLines = (m) => m.replace(/[^\n]/g, '');
  let svg = original
    .replace(/<!--[\s\S]*?-->/g, keepLines)
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, keepLines)
    .replace(/<\?xml[\s\S]*?\?>/g, keepLines)
    .replace(/<!DOCTYPE[\s\S]*?>/gi, keepLines);

  // Aktive Inhalte: lieber ablehnen als still reparieren
  const active = [
    [/<script\b/i, '<script>'],
    [/<foreignObject\b/i, '<foreignObject>'],
    [/[\s/"']on[a-z]+\s*=/i, 'Event-Handler (onclick=… o. ä.)'],
    [/(?:href|src)\s*=\s*["']?\s*(?:javascript|data|vbscript)\s*:/i, 'Link mit javascript: oder data:'],
  ];
  for (const [re, what] of active) {
    const m = re.exec(svg);
    if (m) throw new Error(`SVG enthält ${what} (Zeile ${lineAt(svg, m.index)}). Das ist in Zeichnungen und Karten nicht erlaubt.`);
  }

  checkBalance(svg);

  svg = svg
    .replace(/<metadata\b[\s\S]*?<\/metadata>/gi, '')
    .replace(/<sodipodi:namedview\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/>|>[\s\S]*?<\/sodipodi:namedview>)/gi, '')
    .trim();

  const open = ROOT_RE.exec(svg);
  if (!open || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error('Datei beginnt nicht mit <svg …> oder endet nicht mit </svg>');
  }

  if (/<style\b/i.test(svg)) {
    warnings.push('enthält <style>. Diese Regeln gelten auf der ganzen Seite und können andere Zeichnungen verändern. Besser Farben direkt als Attribute (fill="…") speichern.');
  }
  if (/<image\b/i.test(svg)) {
    warnings.push('enthält eingebettete Bilder (<image>). Zeichnungen sollten reine Vektorgrafik sein.');
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

/** Liest das aria-label einer SVG-Datei (oder null). */
export function svgLabel(source) {
  const open = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(String(source));
  if (!open) return null;
  const m = /\saria-label\s*=\s*(["'])(.*?)\1/.exec(open[0]);
  return m ? m[2].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : null;
}

/** Fügt nummerierte Markierungen (Orte) in eine Karte ein. */
export function addPins(svg, pins) {
  const marks = pins
    .map(({ n, x, y }) => {
      const cx = Math.round(x * 10) / 10;
      const cy = Math.round(y * 10) / 10;
      const ty = Math.round((cy + 4.2) * 10) / 10;
      return `<circle cx="${cx}" cy="${cy}" r="10.5" fill="#0b7f86" stroke="#ffffff" stroke-width="2"/><text x="${cx}" y="${ty}" text-anchor="middle" class="t-pin">${n}</text>`;
    })
    .join('');
  return svg.replace(/<\/svg>\s*$/i, () => `${marks}</svg>`);
}

/** Ersatzbild, solange es für eine Art noch keine Zeichnung gibt. */
export function placeholderPlate(name) {
  return `<svg class="plate" viewBox="0 0 320 240" role="img" aria-label="${esc(`Noch keine Zeichnung: ${name}`)}" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="#efe6d2"/><path d="M112 150 C118 118 150 100 178 108 C196 92 222 92 232 104 C222 106 214 112 210 120 C214 140 200 162 172 168 L118 196 L126 168 C116 166 110 160 112 150 Z" fill="#d8cdb4"/><circle cx="214" cy="106" r="3" fill="#b5a888"/><text x="160" y="222" text-anchor="middle" font-size="13" font-weight="700" fill="#5f5540">Zeichnung folgt</text></svg>`;
}
