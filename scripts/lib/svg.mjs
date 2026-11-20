// SVG-Dateien (Zeichnungen, Karten) für das Einbetten in HTML vorbereiten.

import { esc } from './text.mjs';

/**
 * Bereinigt eine SVG-Datei und macht sie einbettbar:
 *  - entfernt XML-Deklaration, DOCTYPE, Kommentare, Editor-Metadaten
 *  - entfernt <script> und on…-Attribute (Sicherheit)
 *  - stellt allen id-Werten ein Präfix voran (keine Kollisionen zwischen Zeichnungen)
 *  - setzt class, role und aria-label am <svg>-Element
 *
 * Liefert { svg, warnings, markers }.
 */
export function prepareSvg(source, { prefix, className, label }) {
  const warnings = [];
  let svg = String(source)
    .replace(/^﻿/, '')
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/gi, '')
    .trim();

  const open = /^<svg\b[^>]*>/i.exec(svg);
  if (!open || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error('Datei beginnt nicht mit <svg …> oder endet nicht mit </svg>');
  }

  if (/<script\b/i.test(svg)) {
    warnings.push('enthält <script>; wurde entfernt');
    svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  }
  if (/\son[a-z]+\s*=/i.test(svg)) {
    warnings.push('enthält on…-Attribute (Event-Handler); wurden entfernt');
    svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '');
  }
  if (/<style\b/i.test(svg)) {
    warnings.push('enthält <style>. Diese Regeln gelten auf der ganzen Seite und können andere Zeichnungen verändern. Besser Farben direkt als Attribute (fill="…") speichern.');
  }
  if (/<image\b/i.test(svg)) {
    warnings.push('enthält eingebettete Bilder (<image>). Zeichnungen sollten reine Vektorgrafik sein.');
  }

  // ids mit Präfix versehen
  const ids = new Set([...svg.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));
  if (ids.size) {
    const pre = (id) => `${prefix}-${id}`;
    svg = svg
      .replace(/(\sid\s*=\s*")([^"]+)(")/g, (m, a, id, b) => (ids.has(id) ? a + pre(id) + b : m))
      .replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, q, id) => (ids.has(id) ? `url(#${pre(id)})` : m))
      .replace(/((?:xlink:)?href\s*=\s*")#([^"]+)(")/g, (m, a, id, b) => (ids.has(id) ? a + '#' + pre(id) + b : m))
      .replace(/(aria-(?:labelledby|describedby)\s*=\s*")([^"]+)(")/g, (m, a, list, b) =>
        a + list.split(/\s+/).map((id) => (ids.has(id) ? pre(id) : id)).join(' ') + b,
      );
  }

  // Root-Element anpassen
  svg = svg.replace(/^<svg\b([^>]*)>/i, (m, attrs) => {
    let a = attrs;
    if (/\sclass\s*=\s*"/.test(a)) {
      a = a.replace(/(\sclass\s*=\s*")([^"]*)"/, (mm, p, v) => `${p}${[className, v.trim()].filter(Boolean).join(' ')}"`);
    } else {
      a = ` class="${className}"` + a;
    }
    if (!/\srole\s*=/.test(a)) a += ' role="img"';
    if (label !== undefined) {
      if (/\saria-label\s*=\s*"/.test(a)) a = a.replace(/(\saria-label\s*=\s*")[^"]*"/, `$1${esc(label)}"`);
      else a += ` aria-label="${esc(label)}"`;
    }
    return `<svg${a}>`;
  });

  if (!/\sviewBox\s*=/.test(svg.slice(0, svg.indexOf('>')))) {
    warnings.push('hat kein viewBox-Attribut und skaliert deshalb nicht mit der Kartenbreite');
  }

  const markers = (svg.match(/class\s*=\s*"(?:[^"]*\s)?mk(?:\s[^"]*)?"/g) || []).length;
  return { svg, warnings, markers };
}

/** Liest das aria-label einer SVG-Datei (oder null). */
export function svgLabel(source) {
  const open = /<svg\b[^>]*>/i.exec(String(source));
  if (!open) return null;
  const m = /\saria-label\s*=\s*"([^"]*)"/.exec(open[0]);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : null;
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
  return svg.replace(/<\/svg>\s*$/i, `${marks}</svg>`);
}

/** Ersatzbild, solange es für eine Art noch keine Zeichnung gibt. */
export function placeholderPlate(name) {
  return `<svg class="plate" viewBox="0 0 320 240" role="img" aria-label="${esc(`Noch keine Zeichnung: ${name}`)}" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="#efe6d2"/><path d="M112 150 C118 118 150 100 178 108 C196 92 222 92 232 104 C222 106 214 112 210 120 C214 140 200 162 172 168 L118 196 L126 168 C116 166 110 160 112 150 Z" fill="#d8cdb4"/><circle cx="214" cy="106" r="3" fill="#b5a888"/><text x="160" y="222" text-anchor="middle" font-size="13" font-weight="700" fill="#8a7d62">Zeichnung folgt</text></svg>`;
}
