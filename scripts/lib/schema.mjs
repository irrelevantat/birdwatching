// Beschreibung aller erlaubten Felder in site.yml, bird.yml und region.yml.
// Der Prüfer meldet fehlende Pflichtfelder, falsche Typen und Tippfehler in Feldnamen.

import { suggest } from './text.mjs';

const str = { type: 'string' };
const reqStr = { type: 'string', required: true };
const strList = { type: 'list', of: str };
const sourceItem = { type: 'object', fields: { title: reqStr, url: reqStr } };

export const IUCN = {
  LC: { label: 'nicht gefährdet', show: false },
  DD: { label: 'unzureichende Datenlage', show: false },
  NT: { label: 'potenziell gefährdet', show: true, warn: false },
  VU: { label: 'gefährdet', show: true, warn: true },
  EN: { label: 'stark gefährdet', show: true, warn: true },
  CR: { label: 'vom Aussterben bedroht', show: true, warn: true },
  EW: { label: 'in der Natur ausgestorben', show: true, warn: true },
  EX: { label: 'ausgestorben', show: true, warn: true },
};

export const siteSchema = {
  type: 'object',
  fields: {
    title: reqStr,
    eyebrow: str,
    lead: str,
    description: str,
    footer: str,
    repo_url: str,
    regions_title: str,
    species_intro: str,
    photo_hint_linked: str,
    photo_hint_shown: str,
    drawings_note: str,
    fonts_note: str,
  },
};

export const birdSchema = {
  type: 'object',
  fields: {
    name: reqStr,
    title: str,
    english: str,
    scientific: reqStr,
    size: str,
    iucn: { type: 'enum', values: Object.keys(IUCN) },
    marks: strList,
    behavior: str,
    xenocanto: str,
    photo: {
      type: 'object',
      fields: {
        file: str,
        url: str,
        source: str,
        caption: str,
        author: reqStr,
        license: reqStr,
        license_url: str,
      },
    },
    photo_search: str,
    links: { type: 'list', of: sourceItem },
    sources: { type: 'list', of: sourceItem },
  },
};

export const regionSchema = {
  type: 'object',
  fields: {
    name: reqStr,
    title: reqStr,
    eyebrow: str,
    summary: str,
    lead: str,
    updated: str,
    order: { type: 'number' },
    draft: { type: 'boolean' },
    footer: str,
    species_intro: str,
    facts: { type: 'list', of: { type: 'object', fields: { value: reqStr, label: reqStr } } },
    groups: { type: 'list', of: { type: 'object', fields: { id: reqStr, label: reqStr } } },
    birds: {
      type: 'list',
      required: true,
      of: {
        type: 'object',
        fields: {
          id: reqStr,
          group: str,
          local: str,
          status: str,
          chips: strList,
          text: str,
        },
      },
    },
    places: {
      type: 'object',
      fields: {
        title: str,
        intro: str,
        map_label: str,
        map_caption: str,
        sites: {
          type: 'list',
          of: {
            type: 'object',
            fields: {
              name: reqStr,
              tagline: str,
              text: str,
              pin: { type: 'list', of: { type: 'number' } },
              birds: strList,
            },
          },
        },
      },
    },
    season: {
      type: 'object',
      fields: {
        title: str,
        rows: {
          type: 'list',
          of: { type: 'object', fields: { label: reqStr, detail: str, months: { type: 'any', required: true } } },
        },
        note: str,
      },
    },
    tips: {
      type: 'object',
      fields: {
        title: str,
        items: { type: 'list', of: { type: 'object', fields: { title: str, text: reqStr } } },
      },
    },
    more: {
      type: 'object',
      fields: {
        title: str,
        intro: str,
        groups: {
          type: 'list',
          of: {
            type: 'object',
            fields: {
              title: reqStr,
              note: str,
              species: {
                type: 'list',
                of: { type: 'object', fields: { name: reqStr, en: str, sci: str, local: str } },
              },
            },
          },
        },
      },
    },
    sources: {
      type: 'object',
      fields: {
        note: str,
        list: { type: 'list', of: sourceItem },
      },
    },
  },
};

const TYPE_NAMES = {
  string: 'ein Text',
  number: 'eine Zahl',
  boolean: 'true oder false',
  list: 'eine Liste (Zeilen mit „- “)',
  object: 'ein Block mit Unterfeldern',
};

function describe(value) {
  if (value === null || value === undefined) return 'leer';
  if (Array.isArray(value)) return 'eine Liste';
  if (typeof value === 'object') return 'ein Block mit Unterfeldern';
  if (typeof value === 'number') return `die Zahl ${value}`;
  if (typeof value === 'boolean') return `der Wert ${value}`;
  return `der Text „${String(value).slice(0, 40)}“`;
}

/**
 * Prüft `value` gegen `schema`. Gibt eine bereinigte Kopie zurück
 * (Zahlen in Textfeldern werden zu Text). Fehler landen in `errors`
 * als { path, message }.
 */
export function check(value, schema, path, errors) {
  const where = path || '(Datei)';
  if (value === null || value === undefined) {
    if (schema.required) errors.push({ path: where, message: 'Pflichtfeld fehlt oder ist leer' });
    return undefined;
  }
  switch (schema.type) {
    case 'any':
      return value;
    case 'string':
      if (typeof value === 'string') {
        if (schema.required && value.trim() === '') errors.push({ path: where, message: 'Pflichtfeld ist leer' });
        return value;
      }
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.string}, gefunden ${describe(value)}` });
      return undefined;
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
      errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.number}, gefunden ${describe(value)}` });
      return undefined;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.boolean}, gefunden ${describe(value)}` });
      return undefined;
    case 'enum': {
      const v = String(value).trim().toUpperCase();
      if (schema.values.includes(v)) return v;
      errors.push({ path: where, message: `„${value}“ ist nicht erlaubt. Erlaubt: ${schema.values.join(', ')}` });
      return undefined;
    }
    case 'list': {
      if (!Array.isArray(value)) {
        // Einzelwert statt Liste: freundlich umwandeln
        if (schema.of.type !== 'object' && schema.of.type !== 'list' && typeof value !== 'object') {
          return [check(value, schema.of, `${where}[0]`, errors)];
        }
        errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.list}, gefunden ${describe(value)}` });
        return undefined;
      }
      return value.map((item, i) => check(item, { ...schema.of, required: schema.of.required ?? (schema.of.type === 'object') }, `${path}[${i}]`, errors));
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.object}, gefunden ${describe(value)}` });
        return undefined;
      }
      const out = {};
      const keys = Object.keys(schema.fields);
      for (const key of Object.keys(value)) {
        if (!schema.fields[key]) {
          const s = suggest(key, keys);
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Unbekanntes Feld „${key}“.` + (s ? ` Meintest du „${s}“?` : ` Erlaubt: ${keys.join(', ')}`),
          });
        }
      }
      for (const key of keys) {
        const v = check(value[key], schema.fields[key], path ? `${path}.${key}` : key, errors);
        if (v !== undefined) out[key] = v;
      }
      return out;
    }
    default:
      throw new Error(`Unbekannter Schema-Typ ${schema.type}`);
  }
}
