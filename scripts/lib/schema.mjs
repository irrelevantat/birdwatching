// Beschreibung aller erlaubten Felder in site.yml, den Steckbriefen (bird.yml,
// butterfly.yml …) und den Regionsdateien (region.yml, butterflies.yml …).
// Der Prüfer meldet fehlende Pflichtfelder, falsche Typen und Tippfehler in Feldnamen.

import { suggest, isWebUrl } from './text.mjs';
import { KINDS } from './kinds.mjs';

const str = { type: 'string' };
const reqStr = { type: 'string', required: true };
const strList = { type: 'list', of: str };
const url = { type: 'url' };
const reqUrl = { type: 'url', required: true };
const sourceItem = { type: 'object', fields: { title: reqStr, url: reqUrl } };
// Foto oder Illustration mit Urheber und Lizenz
const mediaItem = {
  type: 'object',
  fields: {
    file: str,
    url: url,
    source: str,
    caption: str,
    author: reqStr,
    license: reqStr,
    license_url: url,
  },
};

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

// Texte der Übersichtsseite und der Regionsseiten je Tiergruppe (content/site.yml → animals)
const animalTexts = {
  type: 'object',
  fields: {
    label: str,
    title: str,
    eyebrow: str,
    lead: str,
    description: str,
    regions_title: str,
    species_intro: str,
    drawings_note: str,
  },
};

export const siteSchema = {
  type: 'object',
  fields: {
    title: reqStr,
    eyebrow: str,
    lead: str,
    description: str,
    footer: str,
    repo_url: url,
    regions_title: str,
    species_intro: str,
    drawings_note: str,
    fonts_note: str,
    animals: { type: 'object', fields: Object.fromEntries(KINDS.map((k) => [k.id, animalTexts])) },
  },
};

/** Felder eines Steckbriefs (bird.yml, butterfly.yml …): gemeinsame plus die der Tiergruppe. */
export function speciesSchema(kind) {
  return {
    type: 'object',
    fields: {
      name: reqStr,
      title: str,
      english: str,
      scientific: reqStr,
      size: str,
      iucn: { type: 'enum', values: Object.keys(IUCN) },
      ...kind.fields,
      colors: strList,
      marks: strList,
      behavior: str,
      lookalikes: str,
      photo: mediaItem,
      photo_search: str,
      illustration: mediaItem,
      links: { type: 'list', of: sourceItem },
      sources: { type: 'list', of: sourceItem },
    },
  };
}

/** Felder einer Regionsdatei (region.yml für Vögel, butterflies.yml für Schmetterlinge …). */
export function guideSchema(kind) {
  return {
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
      local_heading: str,
      facts: { type: 'list', of: { type: 'object', fields: { value: reqStr, label: reqStr } } },
      groups: { type: 'list', of: { type: 'object', fields: { id: reqStr, label: reqStr } } },
      [kind.key]: {
        type: 'list',
        required: true,
        of: {
          type: 'object',
          fields: {
            id: reqStr,
            // id eines Lebensraums oder Liste von ids (der erste ist der wichtigste)
            group: { type: 'any' },
            local: str,
            status: str,
            chips: strList,
            text: str,
            months: { type: 'any' },
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
                [kind.key]: strList,
                near: strList,
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
                // name oder sci muss angegeben sein (prüft content.mjs)
                species: {
                  type: 'list',
                  of: { type: 'object', fields: { name: str, en: str, sci: str, local: str } },
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
          // Angaben, die nicht durch die Quellen belegt sind (eigener Absatz bei den Quellen)
          caveats: strList,
        },
      },
    },
  };
}

const TYPE_NAMES = {
  string: 'ein Text',
  url: 'eine Adresse (https://…)',
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
  // Leere Werte („feld:“ ohne Inhalt, ~, null) gelten als nicht angegeben
  if (typeof value === 'string' && (value.trim() === '' || value === '~' || /^null$/i.test(value))) value = null;
  if (value === null || value === undefined) {
    if (schema.required) errors.push({ path: where, message: 'Pflichtfeld fehlt oder ist leer' });
    return undefined;
  }
  switch (schema.type) {
    case 'any':
      return value;
    case 'string':
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1) {
        // Typischer Fall: Text mit „: “ ohne Anführungszeichen wird als Unterfeld gelesen
        const [k, v] = Object.entries(value)[0];
        const text = `${k}: ${v ?? ''}`.trim();
        errors.push({ path: where, message: `Text enthält „: “ und muss deshalb in Anführungszeichen stehen: "${text}"` });
        return undefined;
      }
      errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.string}, gefunden ${describe(value)}` });
      return undefined;
    case 'url':
      if (typeof value === 'string' && isWebUrl(value)) return value.trim();
      errors.push({
        path: where,
        message: typeof value === 'string'
          ? `„${value.slice(0, 60)}“ ist keine gültige Adresse. Sie muss mit https:// (oder http://) beginnen.`
          : `Erwartet ${TYPE_NAMES.url}, gefunden ${describe(value)}`,
      });
      return undefined;
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
      errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.number}, gefunden ${describe(value)}` });
      return undefined;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string' && /^(true|yes|ja)$/i.test(value.trim())) return true;
      if (typeof value === 'string' && /^(false|no|nein)$/i.test(value.trim())) return false;
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
      return value.map((item, i) => check(item, { ...schema.of, required: schema.of.required ?? true }, `${path}[${i}]`, errors));
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ path: where, message: `Erwartet ${TYPE_NAMES.object}, gefunden ${describe(value)}` });
        return undefined;
      }
      const out = {};
      const keys = Object.keys(schema.fields);
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.fields, key)) {
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
