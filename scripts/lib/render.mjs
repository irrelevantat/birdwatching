// HTML-Vorlagen: Übersichtsseiten (je Tiergruppe), Regionsseiten und 404-Seite.
// Eine Seite zeigt immer nur eine Tiergruppe; oben auf jeder Seite wechselt man sie.
//
// Eine Region besteht je Tiergruppe aus mehreren Seiten (<region> = z. B. „ometepe/“
// für Vögel oder „schmetterlinge/ometepe/“ für Schmetterlinge):
//   <region>/                 „Vogel gesehen?“ und die Liste aller Arten (Hauptseite)
//   <region>/arten/<art>/     Steckbrief einer Art
//   <region>/orte/            Karte und Beobachtungsorte
//   <region>/wann-und-wie/    Jahreslauf und Tipps
//   <region>/weitere-arten/   Arten ohne eigenen Steckbrief
//   <region>/quellen/         Bildnachweise und Quellen
// Unterseiten ohne Inhalt entfallen, auch im Menü.

import { IUCN } from './schema.mjs';
import { esc, inline, fill, link, numberWord, plural, MONTH_LETTERS, queryValue } from './text.mjs';
import { placeholderPlate } from './kinds.mjs';
import { COLORS, MONTH_SHORT } from './finder.mjs';

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Ordner der Steckbriefe innerhalb einer Region. */
export const SPECIES_DIR = 'arten';

/** Text ohne Formatierung, z. B. für <meta name="description">. */
export function plain(text) {
  return String(text ?? '')
    .replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, '$1')
    .replace(/\*\*(\S(?:[^*\n]|\*(?!\*))*?)\*\*/g, '$1')
    .replace(/\*(\S[^*\n]*?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text aus site.yml für eine Tiergruppe (animals.<id>.<feld>), sonst der allgemeine. */
export function kindText(site, kind, field) {
  const own = site.animals?.[kind.id]?.[field];
  if (own !== undefined) return own;
  if (field === 'title') return kind.title;
  if (field === 'label') return kind.label;
  return site[field];
}

/** Artname als HTML; ist er der wissenschaftliche Name, kursiv. */
function speciesName(sp, text = sp.name) {
  return text === sp.scientific ? `<i>${esc(text)}</i>` : esc(text);
}

/** Anzahl Ordnerebenen eines Pfads wie „schmetterlinge/ometepe/orte/“. */
const depthOf = (p) => String(p).split('/').filter(Boolean).length;

// ---------------------------------------------------------------------------
// Rahmen jeder Seite

// Symbole für das Menü (24×24, Linien in currentColor)
const ICONS = {
  find: '<circle cx="6.5" cy="15.5" r="3.8"/><circle cx="17.5" cy="15.5" r="3.8"/><path d="M10.3 15.2h3.4M3.2 13.6 5.6 6.2a1.6 1.6 0 0 1 1.5-1.1h1.5a1.4 1.4 0 0 1 1.4 1.3l.6 6.4M20.8 13.6l-2.4-7.4a1.6 1.6 0 0 0-1.5-1.1h-1.5A1.4 1.4 0 0 0 14 6.4l-.6 6.4"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
  season: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2"/>',
  more: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><circle cx="5" cy="6.5" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="5" cy="17.5" r="1.1"/>',
  sources: '<path d="M5 19.5V5.5A2 2 0 0 1 7 3.5h12v13H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12"/><path d="M9 8h6"/>',
};
const icon = (name) =>
  `<svg class="ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

function head({ title, description, base, assets, url, noindex = false }) {
  const d = plain(description);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
${d ? `<meta name="description" content="${esc(d)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
${d ? `<meta property="og:description" content="${esc(d)}">\n` : ''}<meta property="og:locale" content="de_DE">
${url ? `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n` : ''}${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#f1f4f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101614" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${base}assets/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/source-serif-4-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/style.css?v=${assets.css}">
</head>`;
}

function footer(site, { updated, extra = '' } = {}) {
  const parts = [];
  if (updated) parts.push(`Stand: ${esc(updated)}`);
  if (site.footer) parts.push(inline(site.footer));
  if (extra) parts.push(extra);
  if (site.repo_url) parts.push(link(site.repo_url, 'Quelltext auf GitHub'));
  return `<footer class="foot"><div class="wrap">${parts.join(' · ')}</div></footer>`;
}

/**
 * Auswahl der Tiergruppe. ctx.nav: Tiergruppen mit Regionen, je { kind, label, count,
 * regions: Map id → Regionsseite }. Auf den Seiten einer Region führt der Wechsel zur
 * selben Region (falls es sie für die andere Tiergruppe gibt). `exact`: Diese Seite ist
 * die Hauptseite (dann aria-current="page", sonst „true“).
 */
function kindSwitch(ctx, base, current, region = null, exact = true) {
  const nav = ctx.nav || [];
  if (nav.length < 2) return '';
  const href = (p) => base + p || './';
  const items = nav.map((n) => {
    const target = region ? n.regions.get(region.id) : null;
    const count = region ? target?.entries.length : n.count;
    const here = n.kind === current;
    const label = region && !target ? `${n.label} (andere Regionen)` : n.label;
    const cur = here ? ` aria-current="${exact ? 'page' : 'true'}"` : '';
    return `<li><a href="${esc(href(target ? target.path : n.kind.path))}"${cur}${region && !target ? ` aria-label="${esc(label)}"` : ''}>${esc(n.label)}${count ? ` <b>${count}</b>` : ''}</a></li>`;
  });
  return `<nav class="kinds" aria-label="Tiergruppe wählen"><ul>${items.join('')}</ul></nav>`;
}

/**
 * Kopf jeder Seite: oben Website und Tiergruppe, darunter (bei Regionen) Region und Menü.
 * Auf schmalen Bildschirmen steht das Menü als Leiste am unteren Rand, damit
 * „Vogel gesehen?“ von jeder Seite aus erreichbar ist.
 */
function header(site, ctx, { base, kind, region = null, toRegion = '', nav = [], current = null, exact = true }) {
  const home = kind ? base + kind.path || './' : base || './';
  const switcher = kind ? kindSwitch(ctx, base, kind, region, exact && (!region || current === 'find')) : '';
  const top = `<div class="site-bar"><div class="wrap site-in${switcher ? ' has-kinds' : ''}">
<a href="${esc(home)}" class="brand-home">${kind && kindText(site, kind, 'title') !== site.title ? `<span class="bt-long">${esc(kindText(site, kind, 'title'))}</span><span class="bt-short">${esc(site.title)}</span>` : esc(site.title)}</a>
${switcher ? switcher + '\n' : ''}</div></div>`;
  if (!region) return `<a class="skip" href="#inhalt">Zum Inhalt</a>\n<header class="head">\n${top}\n</header>`;
  const items = nav
    .map((n) => {
      const attrs = [`href="${toRegion}${n.href}"`, `class="nav-${n.key}${n.key === current ? ' on' : ''}"`];
      if (n.key === current && n.exact) attrs.push('aria-current="page"');
      if (n.old) attrs.push(`data-old="${n.old}"`);
      return `<a ${attrs.join(' ')}>${icon(n.icon)}<span>${esc(n.label)}</span></a>`;
    })
    .join('');
  return `<a class="skip" href="#inhalt">Zum Inhalt</a>
<header class="head">
${top}
<div class="bar"><div class="wrap bar-in">
<a href="${toRegion || './'}" class="brand-region">${esc(region.name)}</a>
<nav class="regnav" aria-label="${esc(`${region.name}: ${kindText(site, kind, 'label')}`)}">${items}</nav>
</div></div>
</header>`;
}

function page({ site, title, description, ctx, path, kind = null, region = null, nav = [], current = null, exact = true, bodyClass, main, updated, extra }) {
  const base = '../'.repeat(depthOf(path));
  const toRegion = region ? '../'.repeat(depthOf(path) - depthOf(region.path)) : '';
  const navItems = nav.map((n) => ({ ...n, exact: n.key === current && exact }));
  return `${head({ title, description, base, assets: ctx.assets, url: ctx.siteUrl ? `${ctx.siteUrl}${path}` : null })}
<body class="${bodyClass}${nav.length ? ' has-nav' : ''}">
${header(site, ctx, { base, kind, region, toRegion, nav: navItems, current, exact })}
<main id="inhalt" class="wrap">
${main}
</main>
${footer(site, { updated, extra })}
${region ? `<script src="${base}assets/guide.js?v=${ctx.assets.js}" defer></script>\n` : ''}</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Bausteine

function licenseHtml(p) {
  return p.licenseUrl ? link(p.licenseUrl, esc(p.license)) : esc(p.license);
}

function creditHtml(sp, ctx) {
  const lines = [];
  const il = sp.illustration;
  if (il && ctx.illustrations?.has(sp)) {
    lines.push(`<p class="credit">Illustration: ${link(il.page, esc(il.caption))} · ${inline(il.author)} · ${licenseHtml(il)}${il.source ? ` · ${esc(il.source)}` : ''}</p>`);
  }
  const p = sp.photo;
  if (p) {
    const source = p.source ? ` · ${esc(p.source)}` : '';
    lines.push(`<p class="credit">Foto: ${link(p.page, esc(p.caption))} · ${inline(p.author)} · ${licenseHtml(p)}${source}</p>`);
  } else {
    const q = queryValue(sp.photo_search || sp.scientific);
    const url = `https://commons.wikimedia.org/w/index.php?search=${q}&title=Special:MediaSearch&type=image`;
    lines.push(`<p class="credit">Kein Einzelfoto mit geprüfter Lizenz. ${link(url, 'Fotosuche bei Wikimedia Commons')}</p>`);
  }
  return lines.join('\n');
}

/** Zeile mit zwölf Monatsbuchstaben; `set` = Monate (1–12), die markiert sind. */
function monthBar(set, label) {
  return `<div class="months" role="img" aria-label="${esc(label)}">${MONTH_LETTERS.map((l, i) => `<span class="${set.has(i + 1) ? 'on' : 'off'}">${l}</span>`).join('')}</div>`;
}

function monthList(set) {
  return [...set].sort((a, b) => a - b).map((m) => MONTH_NAMES[m - 1]).join(', ');
}

/** Arten in Anzeigereihenfolge: nach Lebensraum (Hauptgruppe), innerhalb davon wie in der Regionsdatei. */
function orderedEntries(region) {
  const groups = region.groups.filter((g) => region.entries.some((e) => e.group === g.id));
  if (!groups.length) return { list: region.entries, sections: [{ group: null, entries: region.entries }] };
  const sections = groups.map((g) => ({ group: g, entries: region.entries.filter((e) => e.group === g.id) }));
  const rest = region.entries.filter((e) => !sections.some((s) => s.entries.includes(e)));
  if (rest.length) sections.push({ group: null, entries: rest });
  return { list: sections.flatMap((s) => s.entries), sections };
}

/** Zeichnung ohne eigene Beschriftung (für Vorschaubilder neben dem Namen). */
function decorative(svg) {
  return svg.replace(/^<svg\b([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/\srole="[^"]*"/, '').replace(/\saria-label="[^"]*"/, '')} aria-hidden="true" focusable="false">`);
}

/** Größenangabe, die mit einer Zahl beginnt („80–104 cm“, „ca. 23 cm“), nicht „Spannweite …“. */
const NUMERIC_SIZE = /^\s*(ca\.?\s*)?\d/;

/** „Vogel gesehen?“, „Schmetterling gesehen?“ */
const seenLabel = (kind) => `${kind.one} gesehen?`;

// ---------------------------------------------------------------------------
// Hauptseite einer Region: „… gesehen?“ und alle Arten

/** Daten für „… gesehen?“ als Attribute der Artkarte. */
function finderData(entry, region) {
  const sp = entry.species;
  const attrs = [];
  if (entry.monthSet && entry.monthSet.size < 12) attrs.push(`data-months="${[...entry.monthSet].sort((a, b) => a - b).join(' ')}"`);
  if (sp.len) attrs.push(`data-len="${sp.len.join(' ')}"`);
  if (sp.colorIds?.length) attrs.push(`data-colors="${sp.colorIds.join(' ')}"`);
  if (entry.groups?.length) attrs.push(`data-groups="${entry.groups.map(esc).join(' ')}"`);
  if (region.sites.length) attrs.push(`data-sites="${(entry.siteIdx || []).join(' ')}"`);
  return attrs.length ? ' ' + attrs.join(' ') : '';
}

/**
 * Karte in der Artenliste. Das Vorschaubild zeigt immer zuerst die Zeichnung, dann
 * Illustration und Foto (falls vorhanden), in derselben Reihenfolge wie der Steckbrief;
 * guide.js macht daraus eine Bildleiste zum Wischen.
 * Die Bilder sind hier Beiwerk zum Namen (alt=""); Urheber und Lizenz stehen im Steckbrief,
 * auf der Seite „Bilder & Quellen“ und im Tooltip des Fotos.
 */
function speciesCard(entry, region, ctx, base) {
  const sp = entry.species;
  const kind = region.kind;
  const views = [];
  views.push(`<figure class="tslide plate-view" data-view="Zeichnung">${decorative(sp.plate ? sp.plate.svg : placeholderPlate(sp.name, kind))}</figure>`);
  const illustrationSrc = ctx.illustrations?.get(sp);
  if (illustrationSrc) {
    const il = sp.illustration;
    views.push(
      `<figure class="tslide illus" data-view="Illustration"><img src="${esc(base + illustrationSrc)}" alt="" loading="lazy" decoding="async" title="${esc(`Illustration: ${plain(il.author)} · ${il.license}`)}"></figure>`,
    );
  }
  const photoSrc = ctx.photos.get(sp);
  if (photoSrc) {
    const credit = sp.photo ? ` title="${esc(`Foto: ${plain(sp.photo.author)} · ${sp.photo.license}`)}"` : '';
    views.push(`<figure class="tslide photo" data-view="Foto"><img src="${esc(base + photoSrc)}" alt="" loading="lazy" decoding="async"${credit}></figure>`);
  }
  // Eine eigene Größenangabe mit Zahl (size: 80–104 cm) hat Vorrang; die Länge (length) kann
  // für die Suche bewusst weiter gefasst sein, z. B. wenn Doppelgänger mitzählen
  const ownSize = sp.size && NUMERIC_SIZE.test(sp.size);
  const size = ownSize ? sp.sizeLabel : sp.len ? kind.size.chip(sp.len) : sp.sizeLabel;
  const sub = [entry.local ? `<span class="local">${esc(entry.local)}</span>` : '', size ? `<span>${esc(size)}</span>` : ''].filter(Boolean).join('');
  const iucn = sp.iucn && IUCN[sp.iucn];
  const flag = iucn && iucn.warn ? `<span class="flag">${esc(iucn.label)}</span>` : '';
  return `<article class="bird" id="${esc(sp.id)}"${finderData(entry, region)}>
<div class="thumb" aria-hidden="true"><div class="tframe"><div class="tslides" tabindex="-1">${views.join('')}</div></div></div>
<div class="bird-body">
<h4 class="bird-name"><a href="${SPECIES_DIR}/${esc(sp.id)}/">${speciesName(sp, sp.title || sp.name)}</a></h4>
${sub ? `<p class="bird-sub">${sub}</p>\n` : ''}${flag}</div>
</article>`;
}

function finderPanel(region, habitats) {
  const kind = region.kind;
  const btn = (attrs, label, extra = '') => `<button type="button" ${attrs} aria-pressed="false"${extra}>${label}</button>`;
  const row = (legend, cls, body) => `<fieldset class="frow"><legend>${legend}</legend><div class="opts ${cls}">${body}</div></fieldset>`;
  const colors = COLORS.map((c) => btn(`data-c="${c.id}" data-near="${c.near.join(' ')}"`, `<span class="sw" style="background:${c.hex}" aria-hidden="true"></span>${esc(c.label)}`)).join('');
  const sizes = kind.size.classes
    .map((c) => btn(`data-s="${c.id}" data-min="${c.min}" data-max="${c.max}"${c.say ? ` data-say="${esc(c.say)}"` : ''}`, `${esc(c.label)}<small>${esc(c.hint)}</small>`))
    .join('');
  const habitatBtns = habitats.map((g) => btn(`data-l="${esc(g.id)}"`, esc(g.label))).join('');
  const sites = region.sites
    .map((s, i) =>
      btn(`data-o="${esc(s.slug)}" data-i="${i}" data-near="${s.neighbours.join(' ')}"`, `<span class="n" aria-hidden="true">${i + 1}</span>${esc(s.name)}`),
    )
    .join('');
  const months = MONTH_NAMES.map((name, i) => btn(`data-m="${i + 1}"`, MONTH_SHORT[i], ` aria-label="${name}"`)).join('');
  const rows = [
    row('Farben <small>mehrere möglich</small>', 'o-colors', colors),
    row(esc(kind.size.legend), `o-sizes o-sizes-${kind.size.classes.length}`, sizes),
    habitatBtns ? row('Lebensraum', 'o-habitats', habitatBtns) : '',
    sites ? row('Ort', 'o-sites', sites) : '',
    row('Monat', 'o-months', months),
  ].filter(Boolean);
  return `<section class="finder" id="finder" aria-labelledby="finder-h" hidden>
<div class="finder-head">
<h2 id="finder-h" tabindex="-1">${esc(seenLabel(kind))}</h2>
<p class="finder-hint">Tippe an, was dir aufgefallen ist. Die passendsten Arten rücken nach oben.</p>
</div>
${rows.join('\n')}
<div class="finder-foot"><p class="finder-status" role="status"></p><a class="to-results" href="#arten">Treffer <span aria-hidden="true">↓</span></a><button type="button" class="finder-reset" disabled><span class="x" aria-hidden="true">✕</span><span class="reset-label">Zurücksetzen</span></button></div>
</section>`;
}

function renderHome(region, site, ctx, nav) {
  const kind = region.kind;
  const path = region.path;
  const base = '../'.repeat(depthOf(path));
  const { sections } = orderedEntries(region);
  const habitats = region.groups.filter((g) => region.entries.some((e) => e.groups.includes(g.id)));
  const anyPhoto = region.entries.some((e) => ctx.photos.has(e.species));
  const anyIllustration = region.entries.some((e) => ctx.illustrations?.has(e.species));
  const credited = [anyPhoto && 'Fotos', anyIllustration && 'Illustrationen'].filter(Boolean).join(' und ');
  const listNote =
    credited && ctx.pages.has('sources')
      ? `Wische über ein Bild für ${anyPhoto ? 'Zeichnung und Foto' : 'Zeichnung und Illustration'}. Urheber und Lizenz der ${credited} stehen im Steckbrief jeder Art und unter <a href="quellen/">Bilder &amp; Quellen</a>.`
      : '';
  const n = region.entries.length;
  const grid = sections
    .filter((s) => s.entries.length)
    .map((s) => {
      const label = s.group ? s.group.label : sections.length > 1 ? 'Weitere' : 'Alle Arten';
      const count = `${s.entries.length} ${plural(s.entries.length, 'Art', 'Arten')}`;
      return `<h3 class="tier grp">${esc(label)} <span>${count}</span></h3>\n${s.entries.map((e) => speciesCard(e, region, ctx, base)).join('\n')}`;
    })
    .join('\n');

  const facts = (region.facts || []).filter(Boolean);
  const factsHtml = facts.length
    ? `<dl class="facts">\n${facts.map((f) => `<div><dt>${inline(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('\n')}\n</dl>\n`
    : '';
  const intro = region.species_intro || kindText(site, kind, 'species_intro');
  const about =
    region.lead || factsHtml || intro
      ? `<section class="about" aria-labelledby="ueber">
<h2 id="ueber">Über ${esc(region.name)}</h2>
${region.lead ? `<p class="lead">${inline(fill(region.lead, region.vars))}</p>\n` : ''}${factsHtml}${intro ? `<p class="note">${inline(fill(intro, region.vars))}</p>\n` : ''}</section>`
      : '';

  const main = `<div class="hero">
${region.eyebrow ? `<p class="eyebrow">${esc(region.eyebrow)}</p>\n` : ''}<h1>${esc(region.title)}</h1>
</div>
<div class="finder-layout">
${n ? finderPanel(region, habitats) : '<p class="intro">Noch keine Arten.</p>'}
<section class="species" id="arten" aria-labelledby="arten-h">
<h2 id="arten-h" class="vh">${n} ${plural(n, 'Art', 'Arten')}</h2>
<div class="grid">
${grid}
</div>
${listNote ? `<p class="grid-note">${listNote}</p>\n` : ''}</section>
</div>
${about}`;

  return page({
    site,
    title: region.title,
    description: fill(region.summary || region.lead || '', region.vars),
    ctx,
    path,
    kind,
    region,
    nav,
    current: 'find',
    bodyClass: `p-home k-${kind.id}`,
    main,
    updated: region.updated,
    extra: region.footer ? inline(region.footer) : '',
  });
}

// ---------------------------------------------------------------------------
// Steckbrief einer Art

function chipsHtml(entry, sp, region) {
  const chips = [];
  if (sp.len && sp.size && !NUMERIC_SIZE.test(sp.size)) chips.push(`<li>${esc(region.kind.size.chip(sp.len))}</li>`);
  if (sp.sizeLabel) chips.push(`<li>${esc(sp.sizeLabel)}</li>`);
  if (entry.status) chips.push(`<li>${esc(entry.status)}</li>`);
  const iucn = sp.iucn && IUCN[sp.iucn];
  if (iucn && iucn.show) chips.push(`<li${iucn.warn ? ' class="warn"' : ''}>${esc(iucn.label)}</li>`);
  for (const c of entry.chips || []) chips.push(`<li>${esc(c)}</li>`);
  for (const g of entry.groups || []) {
    const group = region.groups.find((x) => x.id === g);
    if (group) chips.push(`<li class="hab">${esc(group.label)}</li>`);
  }
  return chips.length ? `<ul class="chips">${chips.join('')}</ul>\n` : '';
}

function mediaHtml(sp, ctx, base) {
  const heading = sp.title || sp.name;
  const photoSrc = ctx.photos.get(sp);
  const illustrationSrc = ctx.illustrations?.get(sp);
  // Ansichten: Zeichnung, Illustration (CC-Grafik aus dem Repository), Foto
  const slides = [];
  if (sp.plate) slides.push({ label: 'Zeichnung', html: `<figure class="slide">${sp.plate.svg}</figure>` });
  if (illustrationSrc) {
    slides.push({
      label: 'Illustration',
      html: `<figure class="slide illus"><img src="${esc(base + illustrationSrc)}" alt="${esc(`Illustration: ${sp.illustration.caption}`)}" loading="lazy" decoding="async"></figure>`,
    });
  }
  if (photoSrc) {
    slides.push({
      label: 'Foto',
      html: `<figure class="slide photo"><img src="${esc(base + photoSrc)}" alt="${esc(`Foto: ${sp.photo.caption}`)}" loading="lazy" decoding="async"></figure>`,
    });
  }
  if (!slides.length) slides.push({ label: 'Zeichnung', html: `<figure class="slide">${placeholderPlate(heading, sp.kind)}</figure>` });
  const views = slides.map((sl) => sl.label);
  const viewsLabel = views.length > 1 ? `${views.slice(0, -1).join(', ')} und ${views.at(-1)}` : views[0];
  const tabs =
    slides.length > 1
      ? `<div class="tabs" role="group" aria-label="Ansicht wählen" hidden>${slides.map((sl, i) => `<button type="button" aria-pressed="${i === 0}">${sl.label}</button>`).join('')}</div>\n`
      : '';
  return `<div class="media"><div class="slides"${slides.length > 1 ? ` role="group" aria-label="${esc(`${viewsLabel}: ${heading}`)}" tabindex="0"` : ''}>${slides.map((sl) => sl.html).join('')}</div></div>
${tabs}${creditHtml(sp, ctx)}`;
}

function renderSpecies(entry, i, list, region, site, ctx, nav) {
  const sp = entry.species;
  const kind = region.kind;
  const path = `${region.path}${SPECIES_DIR}/${sp.id}/`;
  const base = '../'.repeat(depthOf(path));
  const toRegion = '../../';
  const heading = sp.title || sp.name;
  // Ist die Überschrift schon der wissenschaftliche Name, steht er nicht noch einmal darunter
  const nameParts = [sp.english && esc(sp.english), heading !== sp.scientific && `<i>${esc(sp.scientific)}</i>`].filter(Boolean);

  const blocks = [];
  if (sp.marks?.length) {
    blocks.push(`<section class="blk"><h2 class="k">Merkmale${sp.plate ? ' <small>Nummern wie in der Zeichnung</small>' : ''}</h2>
<ol class="marks">${sp.marks.map((m) => `<li>${inline(m)}</li>`).join('')}</ol></section>`);
  }
  for (const [field, label] of kind.texts) {
    if (sp[field]) blocks.push(`<section class="blk"><h2 class="k">${esc(label)}</h2><p>${inline(sp[field])}</p></section>`);
  }
  if (entry.text) blocks.push(`<section class="blk"><h2 class="k">${esc(region.local_heading || `Auf ${region.name}`)}</h2><p>${inline(entry.text)}</p></section>`);
  if (entry.monthSet && entry.monthSet.size < 12) {
    blocks.push(`<section class="blk"><h2 class="k">Wann hier</h2>${monthBar(entry.monthSet, `Hier im ${monthList(entry.monthSet)}`)}</section>`);
  }
  const sites = (entry.siteIdx || []).map((k) => ({ s: region.sites[k], k }));
  if (sites.length && ctx.pages.has('orte')) {
    blocks.push(`<section class="blk"><h2 class="k">Gute Orte</h2><ul class="site-links">${sites
      .map(({ s, k }) => `<li><a href="${toRegion}orte/#${esc(s.slug)}"><span class="n" aria-hidden="true">${k + 1}</span>${esc(s.name)}</a></li>`)
      .join('')}</ul></section>`);
  }
  const links = kind.links(sp);
  for (const l of sp.links || []) links.push(link(l.url, esc(l.title)));

  const prev = list[i - 1];
  const next = list[i + 1];
  const pager = `<nav class="pager" aria-label="Weitere Arten">${
    prev ? `<a rel="prev" href="../${esc(prev.id)}/"><small>Vorige Art</small>${speciesName(prev.species)}</a>` : '<span></span>'
  }${next ? `<a rel="next" href="../${esc(next.id)}/"><small>Nächste Art</small>${speciesName(next.species)}</a>` : ''}</nav>`;

  const main = `<p class="back"><a href="${toRegion}" data-back>← Alle Arten</a></p>
<article class="sp">
<div class="sp-media">
${mediaHtml(sp, ctx, base)}
</div>
<div class="sp-text">
${entry.local ? `<p class="local">vor Ort: <strong>${esc(entry.local)}</strong></p>\n` : ''}<h1>${speciesName(sp, heading)}</h1>
${nameParts.length ? `<p class="names">${nameParts.join(' · ')}</p>\n` : ''}${chipsHtml(entry, sp, region)}${blocks.join('\n')}
<p class="links">${links.join('')}</p>
</div>
</article>
${pager}`;

  const description = `${sp.name} (${sp.scientific}) in der Region ${region.name}: woran du die Art erkennst, wie sie sich verhält und wo du sie findest.`;
  return page({
    site,
    title: `${sp.name} · ${region.title}`,
    description,
    ctx,
    path,
    kind,
    region,
    nav,
    current: 'find',
    exact: false,
    bodyClass: `p-species k-${kind.id}`,
    main,
    updated: region.updated,
    extra: region.footer ? inline(region.footer) : '',
  });
}

// ---------------------------------------------------------------------------
// Unterseiten

function placesPage(region) {
  const kind = region.kind;
  const sites = region.sites;
  if (!sites.length && !region.map) return null;
  const title = region.places?.title || (region.map ? 'Karte & Orte' : 'Orte');
  const map = region.map
    ? `<figure class="mapbox">${region.map.linkedSvg || region.map.svg}${region.places?.map_caption ? `<figcaption>${inline(region.places.map_caption)}</figcaption>` : ''}</figure>\n`
    : '';
  const list = sites.length
    ? `<ol class="sites">\n${sites
        .map((s, i) => {
          const items = (s[kind.key] || [])
            .map((id) => region.entries.find((e) => e.id === id))
            .filter(Boolean)
            .map((e) => `<li><a href="../${SPECIES_DIR}/${esc(e.id)}/">${speciesName(e.species)}</a></li>`)
            .join('');
          return `<li class="site" id="${esc(s.slug)}"><span class="num" aria-hidden="true">${i + 1}</span>
<div><h2>${esc(s.name)}</h2>${s.tagline ? `<p class="tag">${inline(s.tagline)}</p>` : ''}${s.text ? `<p>${inline(s.text)}</p>` : ''}${items ? `\n<ul class="site-birds" aria-label="${esc(kind.siteSpecies)}">${items}</ul>` : ''}
<a class="site-find" href="../?ort=${esc(s.slug)}#finder">${icon('find')}Hier einen ${esc(kind.one)} gesehen?</a></div></li>`;
        })
        .join('\n')}\n</ol>\n`
    : '';
  return {
    key: 'orte',
    href: 'orte/',
    label: 'Orte',
    icon: 'pin',
    old: 'orte',
    title,
    main: `<div class="page-head">
<h1>${esc(title)}</h1>
${region.places?.intro ? `<p class="intro">${inline(fill(region.places.intro, region.vars))}</p>\n` : ''}</div>
<div class="places${region.map ? '' : ' no-map'}">
${map}${list}</div>`,
  };
}

function seasonPage(region) {
  const panels = [];
  const rows = (region.season?.rows || []).filter(Boolean);
  if (rows.length || region.season?.note) {
    const rowHtml = rows
      .map((r) => {
        const label = r.detail ? `${r.label}: ${r.detail}` : `${r.label}: ${monthList(r.monthSet)}`;
        return `<div class="srow"><p class="slabel">${esc(r.label)}${r.detail ? `<small>${esc(r.detail)}</small>` : ''}</p>${monthBar(r.monthSet, label)}</div>`;
      })
      .join('\n');
    panels.push(`<section class="panel">
<h2>${esc(region.season?.title || region.kind.seasonTitle)}</h2>
${rowHtml}
${region.season?.note ? `<p class="season-note">${inline(region.season.note)}</p>\n` : ''}</section>`);
  }
  const tips = (region.tips?.items || []).filter(Boolean);
  if (tips.length) {
    panels.push(`<section class="panel">
<h2>${esc(region.tips?.title || 'So siehst du mehr')}</h2>
<ul class="tips">
${tips.map((t) => `<li>${t.title ? `<strong>${inline(t.title)}</strong> ` : ''}${inline(t.text)}</li>`).join('\n')}
</ul>
</section>`);
  }
  if (!panels.length) return null;
  return {
    key: 'season',
    href: 'wann-und-wie/',
    label: 'Wann & wie',
    icon: 'season',
    old: 'praxis',
    title: 'Wann & wie',
    main: `<div class="page-head"><h1>Wann &amp; wie</h1></div>
<div class="practice">
${panels.join('\n')}
</div>`,
  };
}

function morePage(region) {
  const groups = (region.more?.groups || []).filter(Boolean);
  if (!groups.length) return null;
  const title = region.more?.title || 'Weitere Arten';
  return {
    key: 'more',
    href: 'weitere-arten/',
    label: 'Mehr Arten',
    icon: 'more',
    old: 'mehr',
    title,
    main: `<div class="page-head">
<h1>${esc(title)}</h1>
${region.more?.intro ? `<p class="intro">${inline(region.more.intro)}</p>\n` : ''}</div>
<div class="more-grid">
${groups
  .map((g) => {
    const list = (g.species || []).filter(Boolean);
    const items = list
      .map((s) => {
        // Nur ein wissenschaftlicher Name: er wird zur (kursiven) Überschrift des Eintrags
        const name = s.name ? esc(s.name) : `<i>${esc(s.sci)}</i>`;
        const detail = [s.en && esc(s.en), s.name && s.sci && `<i>${esc(s.sci)}</i>`, s.local && esc(s.local)].filter(Boolean).join(' · ');
        return `<li><strong>${name}</strong>${detail ? `<span>${detail}</span>` : ''}</li>`;
      })
      .join('');
    // Lange Namenslisten laufen in Spalten über die ganze Breite
    const wide = list.length > 14;
    return `<section class="more${wide ? ' wide' : ''}"><h2>${esc(g.title)} <small>${list.length}</small></h2>${g.note ? `<p class="tag">${inline(g.note)}</p>` : ''}<ul>${items}</ul></section>`;
  })
  .join('\n')}
</div>`,
  };
}

function photoNote(region, ctx) {
  const all = region.entries.map((e) => e.species);
  const illustrated = all.filter((b) => ctx.illustrations?.has(b));
  const withPhoto = all.filter((b) => b.photo);
  const missing = all.length - withPhoto.length;
  const sentences = [];
  if (withPhoto.length) {
    const allCommons = withPhoto.every((b) => b.photo.source === 'Wikimedia Commons');
    const allCc = withPhoto.every((b) => /^CC/i.test(b.photo.license));
    sentences.push(
      `Jedes Foto ${allCommons ? 'stammt von Wikimedia Commons und ' : ''}steht unter der genannten ${allCc ? 'Creative-Commons-Lizenz' : 'Lizenz'}.`,
    );
    if (missing) {
      sentences.push(
        `Für ${numberWord(missing)} ${plural(missing, 'Art', 'Arten')} ließ sich kein Einzelfoto mit geprüfter Lizenz festlegen. Dort führt der Link zur Fotosuche, und die Lizenz steht bei jeder Datei.`,
      );
    }
  } else {
    sentences.push('Für die Arten ist noch kein Einzelfoto festgelegt. Die Links führen zur Fotosuche bei Wikimedia Commons, und die Lizenz steht bei jeder Datei.');
  }
  if (illustrated.length) {
    sentences.push(
      `${illustrated.length === 1 ? 'Die Illustration (SVG) liegt' : 'Die Illustrationen (SVG) liegen'} im Repository und ${illustrated.length === 1 ? 'steht' : 'stehen'} unter der jeweils genannten freien Lizenz.`,
    );
  }
  if (region.kind.mediaNote) sentences.push(region.kind.mediaNote);
  return sentences.join(' ');
}

function sourcesPage(region, site, ctx) {
  const all = region.entries.map((e) => e.species);
  const item = (p, sp, prefix = '') => {
    const source = p.source && p.source !== 'Wikimedia Commons' ? `, ${esc(p.source)}` : '';
    return `<li>${prefix}${link(p.page, esc(p.caption))}, ${inline(p.author)}, ${licenseHtml(p)}${source} <span class="for">(${link(`../${SPECIES_DIR}/${sp.id}/`, speciesName(sp))})</span></li>`;
  };
  const items = [
    ...all.filter((b) => ctx.illustrations?.has(b)).map((b) => item(b.illustration, b, 'Illustration: ')),
    ...all.filter((b) => b.photo).map((b) => item(b.photo, b)),
  ];
  const credits = items.length ? `<ul class="credits">\n${items.join('\n')}\n</ul>\n` : '';

  // Quellen der Region plus Quellen aus den Steckbriefen (ohne Dubletten)
  const list = [];
  const seen = new Set();
  for (const s of [...(region.sources?.list || []), ...region.entries.flatMap((e) => e.species.sources || [])]) {
    if (!s || seen.has(s.url)) continue;
    seen.add(s.url);
    list.push(s);
  }
  const caveats = (region.sources?.caveats || []).filter(Boolean);
  const sources =
    list.length || region.sources?.note || caveats.length
      ? `<section class="blk">
<h2>Quellen</h2>
${region.sources?.note ? `<p class="note">${inline(region.sources.note)}</p>\n` : ''}${
          list.length ? `<ol class="sources">\n${list.map((s) => `<li>${link(s.url, esc(s.title))}</li>`).join('\n')}\n</ol>\n` : ''
        }${caveats.length ? `<h3 class="sub">Was nicht belegt ist</h3>\n<ul class="caveats">\n${caveats.map((c) => `<li>${inline(c)}</li>`).join('\n')}\n</ul>\n` : ''}</section>`
      : '';
  const drawingsNote = kindText(site, region.kind, 'drawings_note');

  return {
    key: 'sources',
    href: 'quellen/',
    label: 'Quellen',
    icon: 'sources',
    old: 'quellen',
    title: 'Bilder & Quellen',
    main: `<div class="page-head"><h1>Bilder &amp; Quellen</h1>
${drawingsNote ? `<p class="intro">${inline(drawingsNote)}</p>\n` : ''}</div>
${sources}
<section class="blk">
<h2>Bildnachweise</h2>
<p class="note">${photoNote(region, ctx)}</p>
${credits}${site.fonts_note ? `<p class="note">${inline(site.fonts_note)}</p>\n` : ''}</section>`,
  };
}

/**
 * Alle Seiten einer Region (einer Tiergruppe). Liefert eine Liste { path, html } mit
 * Pfaden relativ zum Ausgabeordner (z. B. „ometepe/orte/index.html“).
 */
export function renderRegionPages(region, site, ctx) {
  const kind = region.kind;
  const subpages = [placesPage(region), seasonPage(region), morePage(region), sourcesPage(region, site, ctx)].filter(Boolean);
  const nav = [
    { key: 'find', href: '', label: kind.findLabel || seenLabel(kind), icon: 'find' },
    ...subpages.map(({ key, href, label, icon: ic, old }) => ({ key, href, label, icon: ic, old })),
  ];
  const rctx = { ...ctx, pages: new Set(subpages.map((p) => p.key)) };
  const extra = region.footer ? inline(region.footer) : '';
  const out = [{ path: `${region.path}index.html`, html: renderHome(region, site, rctx, nav) }];
  const { list } = orderedEntries(region);
  list.forEach((entry, i) => {
    out.push({ path: `${region.path}${SPECIES_DIR}/${entry.id}/index.html`, html: renderSpecies(entry, i, list, region, site, rctx, nav) });
  });
  for (const sp of subpages) {
    out.push({
      path: `${region.path}${sp.href}index.html`,
      html: page({
        site,
        title: `${sp.title} · ${region.title}`,
        description: `${sp.title}: ${plain(fill(region.summary || region.lead || '', region.vars))}`,
        ctx: rctx,
        path: `${region.path}${sp.href}`,
        kind,
        region,
        nav,
        current: sp.key,
        bodyClass: `p-${sp.key} k-${kind.id}`,
        main: sp.main,
        updated: region.updated,
        extra,
      }),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Übersicht je Tiergruppe und 404

/** Übersichtsseite einer Tiergruppe: ihre Regionen (und nur sie). */
export function renderIndex(kind, regions, site, ctx) {
  // Liegt die Übersicht an der Wurzel (ctx.base leer), gilt sie für die ganze Website
  const path = ctx.base ? kind.path : '';
  const base = ctx.base || '';
  const speciesCount = new Set(regions.flatMap((r) => r.entries.map((e) => e.id))).size;
  const siteCount = regions.reduce((sum, r) => sum + r.sites.length, 0);
  const facts = [
    [regions.length, plural(regions.length, 'Region', 'Regionen')],
    [speciesCount, plural(speciesCount, 'Art', 'Arten')],
    [siteCount, plural(siteCount, 'Beobachtungsort', 'Beobachtungsorte')],
  ];
  const cards = regions
    .map((r) => {
      const map = r.map ? `<div class="region-map">${decorative(r.map.svg)}</div>` : '';
      const chips = [
        `${r.entries.length} ${plural(r.entries.length, 'Art', 'Arten')}`,
        r.sites.length ? `${r.sites.length} ${plural(r.sites.length, 'Ort', 'Orte')}` : null,
        r.updated ? `Stand: ${r.updated}` : null,
      ].filter(Boolean);
      const summary = plain(fill(r.summary || r.lead || '', r.vars));
      return `<li class="region-card"><a href="${esc(base + r.path)}">${map}<div class="region-body">
${r.eyebrow ? `<p class="eyebrow">${esc(r.eyebrow)}</p>\n` : ''}<h3>${esc(r.title)}</h3>
${summary ? `<p>${esc(summary)}</p>\n` : ''}<ul class="chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
<span class="region-go">${esc(seenLabel(kind))} Arten bestimmen →</span>
</div></a></li>`;
    })
    .join('\n');

  const title = kindText(site, kind, 'title');
  const eyebrow = kindText(site, kind, 'eyebrow');
  const lead = kindText(site, kind, 'lead');
  const main = `<div class="hero">
${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>\n` : ''}<h1>${esc(title)}</h1>
${lead ? `<p class="lead">${inline(lead)}</p>\n` : ''}<dl class="facts">
${facts.map(([v, l]) => `<div><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>
</div>
<section id="regionen" aria-labelledby="regionen-h">
<h2 id="regionen-h">${esc(kindText(site, kind, 'regions_title') || 'Regionen')}</h2>
<ul class="regions">
${cards}
</ul>
</section>`;
  return page({
    site,
    title,
    description: kindText(site, kind, 'description') || lead || '',
    ctx,
    path,
    kind,
    bodyClass: `p-index k-${kind.id}`,
    main,
  });
}

export function render404(site, ctx) {
  const base = ctx.absBase;
  return `${head({ title: `Seite nicht gefunden · ${site.title}`, description: '', base, assets: ctx.assets, noindex: true })}
<body class="p-404">
${header(site, ctx, { base })}
<main id="inhalt" class="wrap">
<div class="hero">
<p class="eyebrow">Fehler 404</p>
<h1>Seite nicht gefunden</h1>
<p class="lead">Diese Seite gibt es nicht (mehr). <a href="${base}">Zur Übersicht</a></p>
</div>
</main>
${footer(site)}
</body>
</html>
`;
}
