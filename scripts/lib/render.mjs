// HTML-Vorlagen für die Übersichtsseiten (je Tiergruppe), Regionsseiten und 404-Seite.
// Eine Seite zeigt immer nur eine Tiergruppe; oben auf jeder Seite wechselt man sie.

import { IUCN } from './schema.mjs';
import { esc, inline, fill, link, numberWord, plural, MONTH_LETTERS, queryValue } from './text.mjs';
import { placeholderPlate } from './kinds.mjs';
import { COLORS, MONTH_SHORT } from './finder.mjs';

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Text ohne Formatierung, z. B. für <meta name="description">. */
export function plain(text) {
  return String(text ?? '')
    .replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, '$1')
    .replace(/\*\*(\S(?:[^*\n]|\*(?!\*))*?)\*\*/g, '$1')
    .replace(/\*(\S[^*\n]*?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function head({ title, description, base, assets, url, noindex = false }) {
  const d = plain(description);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${d ? `<meta name="description" content="${esc(d)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
${d ? `<meta property="og:description" content="${esc(d)}">\n` : ''}<meta property="og:locale" content="de_DE">
${url ? `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n` : ''}${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${base}assets/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/source-serif-4-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/style.css?v=${assets.css}">
</head>
<body>`;
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

/**
 * Auswahl der Tiergruppe oben auf jeder Seite. ctx.nav: Tiergruppen mit Regionen,
 * je { kind, label, count, regions: Map id → Regionsseite }. Auf einer Regionsseite
 * führt der Wechsel zur selben Region (falls es sie für die andere Tiergruppe gibt).
 */
function kindSwitch(ctx, current, region = null) {
  const nav = ctx.nav || [];
  if (nav.length < 2) return '';
  const href = (p) => ctx.base + p || './';
  const items = nav.map((n) => {
    const target = region ? n.regions.get(region.id) : null;
    const count = region ? target?.entries.length : n.count;
    const here = n.kind === current;
    const label = region && !target ? `${n.label} (andere Regionen)` : n.label;
    return `<li><a href="${esc(href(target ? target.path : n.kind.path))}"${here ? ' aria-current="page"' : ''}${region && !target ? ` aria-label="${esc(label)}"` : ''}>${esc(n.label)}${count ? ` <b>${count}</b>` : ''}</a></li>`;
  });
  return `<nav class="kinds" aria-label="Tiergruppe wählen"><div class="wrap"><ul>${items.join('')}</ul></div></nav>
`;
}

function footer(site, { updated, base, extra = '' } = {}) {
  const parts = [];
  if (updated) parts.push(`Stand: ${esc(updated)}`);
  if (site.footer) parts.push(inline(site.footer));
  if (extra) parts.push(extra);
  if (site.repo_url) parts.push(link(site.repo_url, 'Quelltext auf GitHub'));
  return `<footer><div class="wrap">${parts.join(' · ')}</div></footer>`;
}

function chipsHtml(entry, bird) {
  const chips = [];
  if (bird.sizeLabel) chips.push(`<li>${esc(bird.sizeLabel)}</li>`);
  if (entry.status) chips.push(`<li>${esc(entry.status)}</li>`);
  const iucn = bird.iucn && IUCN[bird.iucn];
  if (iucn && iucn.show) chips.push(`<li${iucn.warn ? ' class="warn"' : ''}>${esc(iucn.label)}</li>`);
  for (const c of entry.chips || []) chips.push(`<li>${esc(c)}</li>`);
  return chips.length ? `<ul class="chips">${chips.join('')}</ul>\n` : '';
}

function licenseHtml(p) {
  return p.licenseUrl ? link(p.licenseUrl, esc(p.license)) : esc(p.license);
}

function creditHtml(bird, ctx) {
  const lines = [];
  const il = bird.illustration;
  if (il && ctx.illustrations?.has(bird)) {
    lines.push(`<p class="credit">Illustration: ${link(il.page, esc(il.caption))} · ${inline(il.author)} · ${licenseHtml(il)}${il.source ? ` · ${esc(il.source)}` : ''}</p>`);
  }
  const p = bird.photo;
  if (p) {
    const source = p.source ? ` · ${esc(p.source)}` : '';
    lines.push(`<p class="credit">Foto: ${link(p.page, esc(p.caption))} · ${inline(p.author)} · ${licenseHtml(p)}${source}</p>`);
  } else {
    const q = queryValue(bird.photo_search || bird.scientific);
    const url = `https://commons.wikimedia.org/w/index.php?search=${q}&title=Special:MediaSearch&type=image`;
    lines.push(`<p class="credit">Kein Einzelfoto mit geprüfter Lizenz. ${link(url, 'Fotosuche bei Wikimedia Commons')} (freie Lizenzen, je Datei angegeben)</p>`);
  }
  return lines.join('');
}

/** Daten für „… gesehen?“ als Attribute der Artkarte. */
function finderData(entry, region) {
  const bird = entry.species;
  const attrs = [];
  if (entry.monthSet && entry.monthSet.size < 12) attrs.push(`data-months="${[...entry.monthSet].sort((a, b) => a - b).join(' ')}"`);
  if (bird.len) attrs.push(`data-len="${bird.len.join(' ')}"`);
  if (bird.colorIds?.length) attrs.push(`data-colors="${bird.colorIds.join(' ')}"`);
  if (region.sites.length) attrs.push(`data-sites="${(entry.siteIdx || []).join(' ')}"`);
  return attrs.length ? ' ' + attrs.join(' ') : '';
}

function speciesCard(entry, region, ctx) {
  const bird = entry.species;
  const kind = region.kind;
  const heading = bird.title || bird.name;
  const photoSrc = ctx.photos.get(bird);
  const illustrationSrc = ctx.illustrations?.get(bird);
  // Ansichten der Karte: Zeichnung, Illustration (CC-Grafik aus dem Repository), Foto
  const slides = [];
  if (bird.plate) slides.push({ label: 'Zeichnung', html: `<figure class="slide">${bird.plate.svg}</figure>` });
  if (illustrationSrc) {
    slides.push({
      label: 'Illustration',
      html: `<figure class="slide illus"><img src="${esc(ctx.base + illustrationSrc)}" alt="${esc(`Illustration: ${bird.illustration.caption}`)}" loading="lazy" decoding="async"></figure>`,
    });
  }
  if (photoSrc) {
    slides.push({
      label: 'Foto',
      html: `<figure class="slide photo"><img src="${esc(ctx.base + photoSrc)}" alt="${esc(`Foto: ${bird.photo.caption}`)}" loading="lazy" decoding="async"></figure>`,
    });
  }
  if (!slides.length) slides.push({ label: 'Zeichnung', html: `<figure class="slide">${placeholderPlate(heading, kind)}</figure>` });
  const tabs = slides.length > 1
    ? `<div class="tabs" role="group" aria-label="Ansicht wählen" hidden>${slides.map((sl, i) => `<button type="button" aria-pressed="${i === 0}">${sl.label}</button>`).join('')}</div>\n`
    : '';

  // Ist die Überschrift schon der wissenschaftliche Name, steht er nicht noch einmal darunter
  const sciHeading = heading === bird.scientific;
  const nameParts = [bird.english && esc(bird.english), !sciHeading && `<i>${esc(bird.scientific)}</i>`].filter(Boolean);
  const names = nameParts.length ? `<p class="names">${nameParts.join(' · ')}</p>` : '';
  const marks = bird.marks?.length ? `<ol class="marks">${bird.marks.map((m) => `<li>${inline(m)}</li>`).join('')}</ol>\n` : '';
  const texts = kind.texts
    .filter(([field]) => bird[field])
    .map(([field, label]) => `<p class="txt"><span class="k">${esc(label)}</span>${inline(bird[field])}</p>\n`)
    .join('');
  const regional = entry.text ? `<p class="txt"><span class="k">${esc(region.local_heading || `Auf ${region.name}`)}</span>${inline(entry.text)}</p>\n` : '';
  const links = kind.links(bird);
  for (const l of bird.links || []) links.push(link(l.url, esc(l.title)));

  const views = slides.map((sl) => sl.label);
  const viewsLabel = views.length > 1 ? `${views.slice(0, -1).join(', ')} und ${views.at(-1)}` : views[0];
  return `<article class="bird" id="${esc(bird.id)}"${entry.group ? ` data-group="${esc(entry.group)}"` : ''}${finderData(entry, region)}>
<div class="media"><div class="slides"${slides.length > 1 ? ` role="group" aria-label="${esc(`${viewsLabel}: ${heading}`)}" tabindex="0"` : ''}>${slides.map((sl) => sl.html).join('')}</div></div>
${tabs}${creditHtml(bird, ctx)}
<div class="bird-body">
${entry.local ? `<p class="local">vor Ort: <strong>${esc(entry.local)}</strong></p>\n` : ''}<h3>${speciesName(bird, heading)}</h3>
${names ? names + '\n' : ''}${chipsHtml(entry, bird)}${marks}${texts}${regional}<p class="links">${links.join('')}</p>
</div>
</article>`;
}

function filters(region) {
  const groups = region.groups.filter((g) => region.entries.some((e) => e.group === g.id));
  if (!groups.length) return '';
  const total = region.entries.length;
  const btn = (id, label, n, pressed) =>
    `<button type="button" id="f-${esc(id)}" data-g="${esc(id)}" aria-pressed="${pressed}">${esc(label)} <b>${n}</b></button>`;
  return `<div class="filters" role="group" aria-label="Arten nach Lebensraum filtern">${[
    btn('alle', 'Alle', total, true),
    ...groups.map((g) => btn(g.id, g.label, region.entries.filter((e) => e.group === g.id).length, false)),
  ].join('')}</div>\n`;
}

function finderPanel(region) {
  const kind = region.kind;
  const btn = (attrs, label, extra = '') => `<button type="button" ${attrs} aria-pressed="false"${extra}>${label}</button>`;
  const months = MONTH_NAMES.map((name, i) => btn(`data-m="${i + 1}"`, MONTH_SHORT[i], ` aria-label="${name}"`)).join('');
  const sizes = kind.size.classes
    .map((c) => btn(`data-s="${c.id}" data-min="${c.min}" data-max="${c.max}"${c.say ? ` data-say="${esc(c.say)}"` : ''}`, `${esc(c.label)}<small>${esc(c.hint)}</small>`))
    .join('');
  const sites = region.sites
    .map((s, i) =>
      btn(
        `data-o="${esc(s.slug)}" data-i="${i}" data-near="${s.neighbours.join(' ')}"`,
        `<span class="n" aria-hidden="true">${i + 1}</span>${esc(s.name)}`,
      ),
    )
    .join('');
  const colors = COLORS.map((c) => btn(`data-c="${c.id}" data-near="${c.near.join(' ')}"`, `<span class="sw" style="background:${c.hex}" aria-hidden="true"></span>${esc(c.label)}`)).join('');
  const row = (legend, cls, body) => `<fieldset class="frow"><legend>${legend}</legend><div class="opts ${cls}">${body}</div></fieldset>`;
  return `<details class="finder" id="finder" hidden>
<summary><span class="finder-q">${esc(kind.one)} gesehen?</span> <span class="finder-sub">Arten nach Monat, Größe, Ort und Farbe sortieren</span><span class="finder-picked"></span></summary>
<div class="finder-body">
<p class="finder-hint">Alle Angaben sind freiwillig und gelten zusammen. Ausgeblendet wird nichts: Oben steht, was am besten passt. Ähnliche Farben sowie angrenzende Monate, Orte und Größen zählen teilweise.</p>
${row('Monat', 'o-months', months)}
${row(esc(kind.size.legend), 'o-sizes', sizes)}
${sites ? row('Ort', 'o-sites', sites) + '\n' : ''}${row('Farben <small>mehrere möglich</small>', 'o-colors', colors)}
<div class="finder-foot"><p class="finder-status" role="status"></p><button type="button" class="finder-reset" disabled>Zurücksetzen</button></div>
</div>
</details>
`;
}

function placesSection(region) {
  const sites = region.sites;
  if (!sites.length && !region.map) return null;
  const title = region.places?.title || (region.map ? 'Karte & Orte' : 'Orte');
  const map = region.map
    ? `<figure class="mapbox">${region.map.svg}${region.places?.map_caption ? `<figcaption>${inline(region.places.map_caption)}</figcaption>` : ''}</figure>\n`
    : '';
  const list = sites.length
    ? `<ol class="sites">\n${sites
        .map((s, i) => {
          const birds = (s[region.kind.key] || [])
            .map((id) => region.entries.find((e) => e.id === id))
            .filter(Boolean)
            .map((e) => `<li><a href="#${esc(e.id)}" data-bird>${speciesName(e.species)}</a></li>`)
            .join('');
          return `<li class="site"><span class="num" aria-hidden="true">${i + 1}</span>
<div><h3>${esc(s.name)}</h3>${s.tagline ? `<p class="tag">${inline(s.tagline)}</p>` : ''}${s.text ? `<p>${inline(s.text)}</p>` : ''}${birds ? `\n<ul class="site-birds" aria-label="${esc(region.kind.siteSpecies)}">${birds}</ul>` : ''}
<button type="button" class="site-find" data-o="${esc(s.slug)}" hidden>Hier einen ${esc(region.kind.one)} gesehen?</button></div></li>`;
        })
        .join('\n')}\n</ol>\n`
    : '';
  return {
    id: 'orte',
    nav: title,
    html: `<section id="orte">
<h2>${esc(title)}</h2>
${region.places?.intro ? `<p class="intro">${inline(fill(region.places.intro, region.vars))}</p>\n` : ''}<div class="places${region.map ? '' : ' no-map'}">
${map}${list}</div>
</section>`,
  };
}

function monthsLabel(row) {
  if (row.detail) return `${row.label}: ${row.detail}`;
  return `${row.label}: ${[...row.monthSet].sort((a, b) => a - b).map((m) => MONTH_NAMES[m - 1]).join(', ')}`;
}

function practiceSection(region) {
  const panels = [];
  const rows = (region.season?.rows || []).filter(Boolean);
  if (rows.length || region.season?.note) {
    const rowHtml = rows
      .map(
        (r) =>
          `<div class="srow"><p class="slabel">${esc(r.label)}${r.detail ? `<small>${esc(r.detail)}</small>` : ''}</p><div class="months" role="img" aria-label="${esc(monthsLabel(r))}">${MONTH_LETTERS.map(
            (l, i) => `<span class="${r.monthSet.has(i + 1) ? 'on' : 'off'}">${l}</span>`,
          ).join('')}</div></div>`,
      )
      .join('');
    panels.push(`<div class="panel">
<h3>${esc(region.season?.title || region.kind.seasonTitle)}</h3>
${rowHtml}
${region.season?.note ? `<p class="tag season-note">${inline(region.season.note)}</p>\n` : ''}</div>`);
  }
  const tips = (region.tips?.items || []).filter(Boolean);
  if (tips.length) {
    panels.push(`<div class="panel">
<h3>${esc(region.tips?.title || 'So siehst du mehr')}</h3>
<ul class="tips">
${tips.map((t) => `<li>${t.title ? `<strong>${inline(t.title)}</strong> ` : ''}${inline(t.text)}</li>`).join('\n')}
</ul>
</div>`);
  }
  if (!panels.length) return null;
  return {
    id: 'praxis',
    nav: 'Wann & wie',
    html: `<section id="praxis">
<h2>Wann &amp; wie</h2>
<div class="practice">
${panels.join('\n')}
</div>
</section>`,
  };
}

function moreSection(region) {
  const groups = (region.more?.groups || []).filter(Boolean);
  if (!groups.length) return null;
  const title = region.more?.title || 'Weitere Arten';
  return {
    id: 'mehr',
    nav: title,
    html: `<section id="mehr">
<h2>${esc(title)}</h2>
${region.more?.intro ? `<p class="intro">${inline(region.more.intro)}</p>\n` : ''}<div class="more-grid">
${groups
  .map((g) => {
    const list = (g.species || []).filter(Boolean);
    const items = list
      .map((s) => {
        // Nur ein wissenschaftlicher Name: er wird zur (kursiven) Überschrift des Eintrags
        const title = s.name ? esc(s.name) : `<i>${esc(s.sci)}</i>`;
        const detail = [s.en && esc(s.en), s.name && s.sci && `<i>${esc(s.sci)}</i>`, s.local && esc(s.local)].filter(Boolean).join(' · ');
        return `<li><strong>${title}</strong>${detail ? `<span>${detail}</span>` : ''}</li>`;
      })
      .join('');
    // Lange Namenslisten laufen in Spalten über die ganze Breite
    const wide = list.length > 14;
    return `<section class="more${wide ? ' wide' : ''}"><h3>${esc(g.title)} <small>${list.length}</small></h3>${g.note ? `<p class="tag">${inline(g.note)}</p>` : ''}<ul>${items}</ul></section>`;
  })
  .join('\n')}
</div>
</section>`,
  };
}

function photoNote(region, ctx) {
  const birds = region.entries.map((e) => e.species);
  const illustrated = birds.filter((b) => ctx.illustrations?.has(b));
  const withPhoto = birds.filter((b) => b.photo);
  const missing = birds.length - withPhoto.length;
  const sentences = [];
  if (withPhoto.length) {
    const allCommons = withPhoto.every((b) => b.photo.source === 'Wikimedia Commons');
    const allCc = withPhoto.every((b) => /^CC/i.test(b.photo.license));
    sentences.push(
      `Jedes verlinkte Foto ${allCommons ? 'stammt von Wikimedia Commons und ' : ''}steht unter der genannten ${allCc ? 'Creative-Commons-Lizenz' : 'Lizenz'}.`,
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

function sourcesSection(region, site, ctx) {
  const birds = region.entries.map((e) => e.species);
  const item = (p, prefix = '') => {
    const source = p.source && p.source !== 'Wikimedia Commons' ? `, ${esc(p.source)}` : '';
    return `<li>${prefix}${link(p.page, esc(p.caption))}, ${inline(p.author)}, ${licenseHtml(p)}${source}</li>`;
  };
  const items = [
    ...birds.filter((b) => ctx.illustrations?.has(b)).map((b) => item(b.illustration, 'Illustration: ')),
    ...birds.filter((b) => b.photo).map((b) => item(b.photo)),
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

  const drawingsNote = kindText(site, region.kind, 'drawings_note');
  const caveats = (region.sources?.caveats || []).filter(Boolean);
  return {
    id: 'quellen',
    nav: 'Quellen',
    html: `<section id="quellen">
<h2>Bilder &amp; Quellen</h2>
${drawingsNote ? `<p class="note">${inline(drawingsNote)}</p>\n` : ''}<h3 class="sub">Bildnachweise</h3>
<p class="note">${photoNote(region, ctx)}</p>
${credits}${site.fonts_note ? `<p class="note">${inline(site.fonts_note)}</p>\n` : ''}${
      list.length || region.sources?.note
        ? `<h3 class="sub">Quellen</h3>
${region.sources?.note ? `<p class="note">${inline(region.sources.note)}</p>\n` : ''}${
            list.length ? `<ol class="sources">\n${list.map((s) => `<li>${link(s.url, esc(s.title))}</li>`).join('\n')}\n</ol>\n` : ''
          }`
        : ''
    }${caveats.length ? `<h3 class="sub">Was nicht belegt ist</h3>\n<ul class="caveats">\n${caveats.map((c) => `<li>${inline(c)}</li>`).join('\n')}\n</ul>\n` : ''}</section>`,
  };
}

export function renderRegion(region, site, ctx) {
  const kind = region.kind;
  const n = region.entries.length;
  const anyPhoto = region.entries.some((e) => ctx.photos.has(e.species));
  const intro = [region.species_intro || kindText(site, kind, 'species_intro'), anyPhoto ? site.photo_hint_shown : site.photo_hint_linked]
    .filter(Boolean)
    .map((t) => inline(fill(t, region.vars)))
    .join(' ');

  const species = {
    id: 'arten',
    nav: 'Arten',
    html: `<section id="arten">
<h2>${n} ${plural(n, 'Art', 'Arten')} zum Kennenlernen</h2>
${intro ? `<p class="intro">${intro}</p>\n` : ''}${filters(region)}${finderPanel(region)}<div class="grid">
${region.entries.map((e) => speciesCard(e, region, ctx)).join('\n')}
</div>
</section>`,
  };
  const sections = [species, placesSection(region), practiceSection(region), moreSection(region), sourcesSection(region, site, ctx)].filter(Boolean);

  const facts = (region.facts || []).filter(Boolean);
  const factsHtml = facts.length
    ? `<dl class="facts">\n${facts.map((f) => `<div><dt>${inline(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('\n')}\n</dl>\n`
    : '';

  return `${head({
    title: region.title,
    description: fill(region.summary || region.lead || '', region.vars),
    base: ctx.base,
    assets: ctx.assets,
    url: ctx.siteUrl ? `${ctx.siteUrl}${region.path}` : null,
  })}
${kindSwitch(ctx, kind, region)}<header class="top"><div class="wrap">
<p class="crumbs"><a href="${esc(ctx.base + kind.path || './')}">← ${esc(kindText(site, kind, 'title'))}</a></p>
${region.eyebrow ? `<p class="eyebrow">${esc(region.eyebrow)}</p>\n` : ''}<h1>${esc(region.title)}</h1>
${region.lead ? `<p class="lead">${inline(fill(region.lead, region.vars))}</p>\n` : ''}${factsHtml}</div></header>

<nav class="jump" aria-label="Abschnitte"><div class="wrap">
${sections.map((s) => `<a href="#${s.id}">${esc(s.nav)}</a>`).join('')}
</div></nav>

<main class="wrap">
${sections.map((s) => s.html).join('\n\n')}
</main>
${footer(site, { updated: region.updated, base: ctx.base, extra: region.footer ? inline(region.footer) : '' })}
<script src="${ctx.base}assets/guide.js?v=${ctx.assets.js}" defer></script>
</body>
</html>
`;
}

/** Übersichtsseite einer Tiergruppe: ihre Regionen (und nur sie). */
export function renderIndex(kind, regions, site, ctx) {
  const speciesCount = new Set(regions.flatMap((r) => r.entries.map((e) => e.id))).size;
  const siteCount = regions.reduce((sum, r) => sum + r.sites.length, 0);
  const facts = [
    [regions.length, plural(regions.length, 'Region', 'Regionen')],
    [speciesCount, plural(speciesCount, 'Art', 'Arten')],
    [siteCount, plural(siteCount, 'Beobachtungsort', 'Beobachtungsorte')],
  ];
  const cards = regions
    .map((r) => {
      const map = r.map
        ? `<div class="region-map">${r.map.svg
            .replace(/\srole="img"/, '')
            .replace(/\saria-label="[^"]*"/, '')
            .replace(/^<svg\b/, '<svg aria-hidden="true" focusable="false"')}</div>`
        : '';
      const chips = [
        `${r.entries.length} ${plural(r.entries.length, 'Art', 'Arten')}`,
        r.sites.length ? `${r.sites.length} ${plural(r.sites.length, 'Ort', 'Orte')}` : null,
        r.updated ? `Stand: ${r.updated}` : null,
      ].filter(Boolean);
      const summary = plain(fill(r.summary || r.lead || '', r.vars));
      return `<li class="region-card"><a href="${esc(ctx.base + r.path)}">${map}<div class="region-body">
${r.eyebrow ? `<p class="eyebrow">${esc(r.eyebrow)}</p>\n` : ''}<h3>${esc(r.title)}</h3>
${summary ? `<p>${esc(summary)}</p>\n` : ''}<ul class="chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
</div></a></li>`;
    })
    .join('\n');

  const title = kindText(site, kind, 'title');
  const eyebrow = kindText(site, kind, 'eyebrow');
  const lead = kindText(site, kind, 'lead');
  return `${head({ title, description: kindText(site, kind, 'description') || lead || '', base: ctx.base, assets: ctx.assets, url: ctx.siteUrl ? `${ctx.siteUrl}${kind.path}` : null })}
${kindSwitch(ctx, kind)}<header class="top"><div class="wrap">
${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>\n` : ''}<h1>${esc(title)}</h1>
${lead ? `<p class="lead">${inline(lead)}</p>\n` : ''}<dl class="facts">
${facts.map(([v, l]) => `<div><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>
</div></header>

<main class="wrap">
<section id="regionen">
<h2>${esc(kindText(site, kind, 'regions_title') || 'Regionen')}</h2>
<ul class="regions">
${cards}
</ul>
</section>
</main>
${footer(site, { base: ctx.base })}
</body>
</html>
`;
}

export function render404(site, ctx) {
  return `${head({ title: `Seite nicht gefunden · ${site.title}`, description: '', base: ctx.absBase, assets: ctx.assets, noindex: true })}
<main class="top"><div class="wrap">
<p class="eyebrow">Fehler 404</p>
<h1>Seite nicht gefunden</h1>
<p class="lead">Diese Seite gibt es nicht (mehr). <a href="${ctx.absBase}">Zur Übersicht aller Regionen</a></p>
</div></main>
${footer(site, { base: ctx.absBase })}
</body>
</html>
`;
}
