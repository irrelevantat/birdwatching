// Grundlagen für „Vogel gesehen?“ auf den Regionsseiten: Farben, Größenklassen,
// Körperlängen und angrenzende Orte. Die Bewertung selbst rechnet assets/guide.js
// im Browser; hier entstehen nur die Daten, die dafür in die Seite geschrieben werden.

import { slugify, suggest } from './text.mjs';

/**
 * Farben zur Auswahl. `near` sind Farben, die man leicht verwechselt oder die
 * je nach Licht ineinander übergehen; sie zählen bei der Sortierung halb.
 */
export const COLORS = [
  { id: 'weiss', label: 'Weiß', hex: '#ffffff', near: ['grau'] },
  { id: 'grau', label: 'Grau', hex: '#9aa2a4', near: ['weiss', 'schwarz', 'braun', 'blau'] },
  { id: 'schwarz', label: 'Schwarz', hex: '#1f2326', near: ['grau', 'braun'] },
  { id: 'braun', label: 'Braun', hex: '#7b5636', near: ['grau', 'schwarz', 'rotbraun'] },
  { id: 'rotbraun', label: 'Rotbraun', hex: '#b4552a', near: ['braun', 'rot', 'orange'] },
  { id: 'rot', label: 'Rot', hex: '#d3302f', near: ['rotbraun', 'orange'] },
  { id: 'orange', label: 'Orange', hex: '#f08a1c', near: ['rot', 'rotbraun', 'gelb'] },
  { id: 'gelb', label: 'Gelb', hex: '#f3d02b', near: ['orange', 'gruen'] },
  { id: 'gruen', label: 'Grün', hex: '#3f9a46', near: ['gelb', 'blau'] },
  { id: 'blau', label: 'Blau', hex: '#2f6fd1', near: ['gruen', 'grau'] },
];

const COLOR_IDS = COLORS.map((c) => c.id);

/**
 * Größenklassen nach bekannten Vögeln (Körperlänge in cm). Die Grenzen liegen
 * zwischen den typischen Längen der Vergleichsvögel. Nachbarklassen zählen
 * bei der Sortierung abgestuft mit.
 */
export const SIZE_CLASSES = [
  { id: 'kolibri', label: 'Kolibri', hint: 'bis 12 cm', min: 0, max: 12 },
  { id: 'spatz', label: 'Spatz', hint: '12–19 cm', min: 12, max: 19 },
  { id: 'amsel', label: 'Amsel', hint: '19–29 cm', min: 19, max: 29 },
  { id: 'taube', label: 'Taube', hint: '29–39 cm', min: 29, max: 39 },
  { id: 'kraehe', label: 'Krähe', hint: '39–58 cm', min: 39, max: 58 },
  { id: 'gans', label: 'Gans', hint: 'über 58 cm', min: 58, max: 0 },
];

export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** „Weiß“, „weiss“, „Grün“ → id der Farbe. Wirft bei unbekannten Farben einen Fehler mit Vorschlag. */
export function parseColor(value) {
  const id = slugify(String(value ?? ''));
  if (COLOR_IDS.includes(id)) return id;
  const s = suggest(id, COLOR_IDS);
  const label = (cid) => COLORS.find((c) => c.id === cid).label.toLowerCase();
  throw new Error(
    `„${value}“ ist keine der Farben.` + (s ? ` Meintest du „${label(s)}“?` : '') + ` Erlaubt: ${COLORS.map((c) => c.label.toLowerCase()).join(', ')}`,
  );
}

const LENGTH_HINT = 'Körperlänge in cm, z. B. 23 oder 43-56';

/** Liest eine Körperlänge: 23, "ca. 23 cm", "43-56", "43–56 cm" oder [43, 56]. Liefert [min, max]. */
export function parseLength(value) {
  let a;
  let b;
  if (typeof value === 'number') {
    a = b = value;
  } else if (Array.isArray(value) && value.length >= 1 && value.length <= 2) {
    [a, b = a] = value.map(Number);
  } else if (typeof value === 'string') {
    const m = /^(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[.,]\d+)?))?\s*(?:cm)?$/i.exec(value.trim());
    if (!m) throw new Error(`„${value}“ ist keine Länge (${LENGTH_HINT})`);
    a = Number(m[1].replace(',', '.'));
    b = m[2] ? Number(m[2].replace(',', '.')) : a;
  } else {
    throw new Error(`Erwartet eine ${LENGTH_HINT}`);
  }
  if (![a, b].every((n) => Number.isFinite(n) && n > 0 && n < 400)) throw new Error(`„${value}“ ist keine Länge (${LENGTH_HINT})`);
  if (a > b) [a, b] = [b, a];
  return [a, b];
}

/** Text für das Größen-Kärtchen: „ca. 23 cm“ oder „43–56 cm“. */
export function lengthLabel([a, b]) {
  const n = (v) => String(v).replace('.', ',');
  return a === b ? `ca. ${n(a)} cm` : `${n(a)}–${n(b)} cm`;
}

/** Eindeutige ids für Orte (für Adressen wie ?ort=charco-verde). */
export function siteSlugs(sites) {
  const used = new Set();
  return sites.map((s, i) => {
    const base = slugify(s.name) || `ort-${i + 1}`;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

/**
 * Angrenzende Orte als Liste von Index-Listen.
 *
 * Hat ein Ort `near` (Namen anderer Orte), gilt diese Liste für ihn. Sonst
 * ermittelt die Seite die Nachbarn aus den Positionen auf der Karte: Zwei Orte
 * grenzen aneinander, wenn kein anderer Ort zwischen ihnen liegt (kein Ort im
 * Kreis, dessen Durchmesser ihre Verbindungslinie ist). Die Beziehung ist
 * immer gegenseitig.
 *
 * `near` muss vorher zu Indizes aufgelöst sein (`nearIdx`).
 */
export function siteNeighbours(sites) {
  const n = sites.length;
  const explicit = (i) => Array.isArray(sites[i].nearIdx);
  const auto = (i, j) => {
    const p = sites[i].pin;
    const q = sites[j].pin;
    if (!p || !q) return false;
    for (let k = 0; k < n; k++) {
      const r = sites[k].pin;
      if (k === i || k === j || !r) continue;
      // r liegt im Kreis über p–q, wenn der Winkel bei r stumpf ist
      if ((p[0] - r[0]) * (q[0] - r[0]) + (p[1] - r[1]) * (q[1] - r[1]) < 0) return false;
    }
    return true;
  };
  const out = sites.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let adjacent;
      if (explicit(i) || explicit(j)) {
        adjacent = (explicit(i) && sites[i].nearIdx.includes(j)) || (explicit(j) && sites[j].nearIdx.includes(i));
      } else {
        adjacent = auto(i, j);
      }
      if (adjacent) {
        out[i].push(j);
        out[j].push(i);
      }
    }
  }
  return out.map((list) => list.sort((a, b) => a - b));
}
