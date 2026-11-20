// Tiergruppen (Vögel, Schmetterlinge …). Jede Tiergruppe hat eigene Steckbriefe,
// eigene Regionsdateien und eigene Seiten; die Seite einer Tiergruppe zeigt nie Arten
// einer anderen. Oben auf jeder Seite wählt man die Tiergruppe.
//
// Eine neue Tiergruppe braucht einen Eintrag hier (Ordner, Dateinamen, Größenklassen
// für die Suche, Wörter für die Seite) und Vorlagen in vorlagen/. Die Texte der
// Übersichtsseite lassen sich in content/site.yml unter „animals“ ändern.

import { esc, queryValue, link } from './text.mjs';

/** Größenklassen nach bekannten Vögeln (Körperlänge in cm). */
export const BIRD_SIZES = [
  { id: 'kolibri', label: 'Kolibri', hint: 'bis 12 cm', min: 0, max: 12 },
  { id: 'spatz', label: 'Spatz', hint: '12–19 cm', min: 12, max: 19 },
  { id: 'amsel', label: 'Amsel', hint: '19–29 cm', min: 19, max: 29 },
  { id: 'taube', label: 'Taube', hint: '29–39 cm', min: 29, max: 39 },
  { id: 'kraehe', label: 'Krähe', hint: '39–58 cm', min: 39, max: 58 },
  { id: 'gans', label: 'Gans', hint: 'über 58 cm', min: 58, max: 0 },
];

/**
 * Größenklassen nach der Spannweite (cm), mit bekannten Faltern aus Mitteleuropa als
 * Vergleich. `say` ist der Text in der Zusammenfassung der Suche.
 */
export const BUTTERFLY_SIZES = [
  { id: 'blaeuling', label: 'Bläuling', hint: 'bis 4 cm', min: 0, max: 4, say: 'wie ein Bläuling' },
  { id: 'kohlweissling', label: 'Kohlweißling', hint: '4–6 cm', min: 4, max: 6, say: 'wie ein Kohlweißling' },
  { id: 'schwalbenschwanz', label: 'Schwalbenschwanz', hint: '6–8 cm', min: 6, max: 8, say: 'wie ein Schwalbenschwanz' },
  { id: 'handteller', label: 'Handteller', hint: '8–11 cm', min: 8, max: 11, say: 'handtellergroß' },
  { id: 'riesig', label: 'Riesig', hint: 'über 11 cm', min: 11, max: 0, say: 'riesig' },
];

const num = (v) => String(v).replace('.', ',');

const BIRD_PLACEHOLDER =
  '<path d="M112 150 C118 118 150 100 178 108 C196 92 222 92 232 104 C222 106 214 112 210 120 C214 140 200 162 172 168 L118 196 L126 168 C116 166 110 160 112 150 Z" fill="#d8cdb4"/><circle cx="214" cy="106" r="3" fill="#b5a888"/>';
const BUTTERFLY_PLACEHOLDER =
  '<path d="M158 112 C140 80 100 62 80 72 C68 80 74 110 96 124 C80 132 76 160 94 172 C114 182 140 160 156 132 Z" fill="#d8cdb4"/><path d="M162 112 C180 80 220 62 240 72 C252 80 246 110 224 124 C240 132 244 160 226 172 C206 182 180 160 164 132 Z" fill="#d8cdb4"/><path d="M160 104 C164 104 165 112 164 128 C163 146 162 160 160 166 C158 160 157 146 156 128 C155 112 156 104 160 104 Z" fill="#b5a888"/><path d="M158 104 C154 92 148 84 142 80 M162 104 C166 92 172 84 178 80" stroke="#b5a888" stroke-width="2" fill="none" stroke-linecap="round"/>';

export const KINDS = [
  {
    id: 'voegel',
    // Ausgabeordner: Vögel liegen an der Wurzel der Website (so bleiben die bisherigen Adressen gültig)
    path: '',
    label: 'Vögel',
    one: 'Vogel',
    // content/<dir>/<art>/<file>; Regionsdatei content/regions/<region>/<guideFile>
    dir: 'birds',
    file: 'bird.yml',
    guideFile: 'region.yml',
    // Name der Artenliste in der Regionsdatei und bei den Orten
    key: 'birds',
    title: 'Vogelführer',
    seasonTitle: 'Das Vogeljahr',
    size: {
      field: 'length',
      what: 'Körperlänge',
      hint: 'Körperlänge in cm, z. B. 23 oder 43-56',
      example: '23',
      legend: 'Größe, etwa wie',
      classes: BIRD_SIZES,
      chip: ([a, b]) => (a === b ? `ca. ${num(a)} cm` : `${num(a)}–${num(b)} cm`),
    },
    // Weitere Felder im Steckbrief (zusätzlich zu den gemeinsamen)
    fields: { length: { type: 'any' }, xenocanto: { type: 'string' } },
    // Absätze auf der Karte: [Feld, Überschrift]
    texts: [['behavior', 'Verhalten'], ['lookalikes', 'Verwechslung']],
    // Liste der Arten bei einem Ort (für Screenreader)
    siteSpecies: 'Typische Arten',
    links: (sp) => [link(`https://xeno-canto.org/explore?query=${queryValue(sp.xenocanto || sp.english || sp.scientific)}`, 'Rufe bei xeno-canto')],
    mediaNote: 'Tonaufnahmen bei xeno-canto tragen ebenfalls je eigene CC-Lizenzen.',
    placeholder: BIRD_PLACEHOLDER,
  },
  {
    id: 'schmetterlinge',
    path: 'schmetterlinge/',
    label: 'Schmetterlinge',
    one: 'Schmetterling',
    dir: 'butterflies',
    file: 'butterfly.yml',
    guideFile: 'butterflies.yml',
    key: 'butterflies',
    title: 'Schmetterlingsführer',
    seasonTitle: 'Das Falterjahr',
    size: {
      field: 'wingspan',
      what: 'Spannweite',
      hint: 'Spannweite in cm, z. B. 8 oder 7-9,5',
      example: '7-9,5',
      legend: 'Spannweite',
      classes: BUTTERFLY_SIZES,
      chip: ([a, b]) => `Spannweite ${a === b ? `ca. ${num(a)}` : `${num(a)}–${num(b)}`} cm`,
    },
    fields: { wingspan: { type: 'any' }, foodplants: { type: 'string' } },
    texts: [['behavior', 'Verhalten'], ['foodplants', 'Raupenfutter'], ['lookalikes', 'Verwechslung']],
    siteSpecies: 'Hier belegte Arten',
    links: (sp) => [link(`https://www.inaturalist.org/taxa/search?q=${queryValue(sp.scientific)}`, 'Art bei iNaturalist')],
    mediaNote: '',
    placeholder: BUTTERFLY_PLACEHOLDER,
  },
];

export const KIND_IDS = KINDS.map((k) => k.id);
export const DEFAULT_KIND = KINDS[0];

/** Tiergruppe zu id („schmetterlinge“), Ordner („butterflies“) oder Bezeichnung („Schmetterlinge“). */
export function findKind(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return KINDS.find((k) => k.id === v || k.dir === v || k.label.toLowerCase() === v) || null;
}

/** Ersatzbild, solange es für eine Art noch keine Zeichnung gibt. */
export function placeholderPlate(name, kind = DEFAULT_KIND) {
  return `<svg class="plate" viewBox="0 0 320 240" role="img" aria-label="${esc(`Noch keine Zeichnung: ${name}`)}" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="#efe6d2"/>${kind.placeholder}<text x="160" y="222" text-anchor="middle" font-size="13" font-weight="700" fill="#5f5540">Zeichnung folgt</text></svg>`;
}
