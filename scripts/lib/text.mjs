// Kleine Text-Helfer: HTML-Escaping, Inline-Formatierung, Zahlwörter, Monate.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

/** Escaped Text für HTML-Inhalt und Attribute. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** true für Links, die die Seite verlassen. */
export function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

/** Erlaubte Link-Ziele: http(s), mailto, Seitenanker und relative Pfade. */
export function isSafeUrl(url) {
  const u = String(url).trim();
  if (/^(https?:|mailto:)/i.test(u)) return true;
  // relative Pfade und Anker, aber keine anderen Schemata wie javascript:
  return !/^[a-z][a-z0-9+.-]*:/i.test(u);
}

export function link(url, label) {
  const rel = isExternal(url) ? ' rel="noopener"' : '';
  return `<a href="${esc(url)}"${rel}>${label}</a>`;
}

/**
 * Wandelt eine kleine Markdown-Teilmenge in sicheres HTML um:
 *   [Text](https://…)  →  Link
 *   **fett**           →  <strong>
 *   *kursiv*           →  <i>
 * Alles andere wird escaped. Rohes HTML ist nicht erlaubt.
 */
export function inline(text) {
  const src = String(text ?? '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const linkM = /^\[([^\]\n]+)\]\(([^()\s]+)\)/.exec(rest);
    if (linkM && isSafeUrl(linkM[2])) {
      out += link(linkM[2], inline(linkM[1]));
      i += linkM[0].length;
      continue;
    }
    const boldM = /^\*\*(?=\S)([^*\n]+?)\*\*/.exec(rest);
    if (boldM) {
      out += `<strong>${inline(boldM[1])}</strong>`;
      i += boldM[0].length;
      continue;
    }
    const itM = /^\*(?=\S)([^*\n]+?)\*/.exec(rest);
    if (itM && !/\s$/.test(itM[1])) {
      out += `<i>${inline(itM[1])}</i>`;
      i += itM[0].length;
      continue;
    }
    out += esc(src[i]);
    i += 1;
  }
  return out;
}

/** Ersetzt Platzhalter wie {arten} oder {orte}. Unbekannte bleiben stehen. */
export function fill(text, vars) {
  return String(text ?? '').replace(/\{([a-zäöüß_]+)\}/gi, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key.toLowerCase()) ? String(vars[key.toLowerCase()]) : m,
  );
}

const WORDS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'];

/** Zahlwort für Fließtext („vier Arten“). Ab 13 Ziffern. `ein` liefert die Form vor Substantiven. */
export function numberWord(n, { one = 'eine' } = {}) {
  if (n === 1) return one;
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

export function plural(n, singular, pluralForm) {
  return n === 1 ? singular : pluralForm;
}

export const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Liest Monatsangaben: "11-4" (Bereich, auch über den Jahreswechsel),
 * "5" oder eine Liste [1, 2, 12]. Liefert ein Set von Monatsnummern 1–12
 * oder wirft einen Fehler mit verständlicher Meldung.
 */
export function parseMonths(value) {
  const months = new Set();
  const add = (m) => {
    const n = Number(m);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error(`„${m}“ ist kein Monat (erlaubt: 1 bis 12)`);
    months.add(n);
  };
  if (Array.isArray(value)) {
    value.forEach(add);
  } else if (typeof value === 'number') {
    add(value);
  } else if (typeof value === 'string') {
    for (const part of value.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const range = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(p);
      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        add(a);
        add(b);
        for (let m = a; m !== b; m = (m % 12) + 1) months.add(m);
      } else {
        add(p);
      }
    }
  } else {
    throw new Error('Monate fehlen (Beispiel: 11-4 oder [1, 2, 12])');
  }
  if (!months.size) throw new Error('Monate fehlen (Beispiel: 11-4 oder [1, 2, 12])');
  return months;
}

/** Macht aus einem Namen einen Ordnernamen: „Grünreiher“ → „gruenreiher“. */
export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Levenshtein-Distanz, für „Meintest du …?“-Hinweise. */
export function distance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

export function suggest(word, candidates) {
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const dd = distance(String(word).toLowerCase(), String(c).toLowerCase());
    if (dd < bestD) {
      bestD = dd;
      best = c;
    }
  }
  const limit = Math.max(2, Math.floor(String(word).length / 3));
  return bestD <= limit ? best : null;
}

/** Formatiert Koordinaten ohne Gleitkomma-Artefakte. */
export function num(n) {
  return String(Math.round(Number(n) * 100) / 100);
}

/** URL-Query-Wert wie in Formularen: Leerzeichen → „+“, Apostroph → %27. */
export function queryValue(value) {
  return new URLSearchParams({ q: String(value) }).toString().slice(2);
}
