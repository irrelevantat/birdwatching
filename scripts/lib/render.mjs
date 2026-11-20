// HTML-Vorlagen für Startseite, Regionsseiten und 404-Seite.

import { IUCN } from './schema.mjs';
import { esc, inline, fill, link, numberWord, plural, MONTH_LETTERS, queryValue } from './text.mjs';
import { placeholderPlate } from './svg.mjs';

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
  if (bird.size) chips.push(`<li>${esc(bird.size)}</li>`);
  if (entry.status) chips.push(`<li>${esc(entry.status)}</li>`);
  const iucn = bird.iucn && IUCN[bird.iucn];
  if (iucn && iucn.show) chips.push(`<li${iucn.warn ? ' class="warn"' : ''}>${esc(iucn.label)}</li>`);
  for (const c of entry.chips || []) chips.push(`<li>${esc(c)}</li>`);
  return chips.length ? `<ul class="chips">${chips.join('')}</ul>\n` : '';
}

function creditHtml(bird) {
  const p = bird.photo;
  if (p) {
    const license = p.licenseUrl ? link(p.licenseUrl, esc(p.license)) : esc(p.license);
    const source = p.source ? ` · ${esc(p.source)}` : '';
    return `<p class="credit">Foto: ${link(p.page, esc(p.caption))} · ${inline(p.author)} · ${license}${source}</p>`;
  }
  const q = queryValue(bird.photo_search || bird.scientific);
  const url = `https://commons.wikimedia.org/w/index.php?search=${q}&title=Special:MediaSearch&type=image`;
  return `<p class="credit">Kein Einzelfoto mit geprüfter Lizenz. ${link(url, 'Fotosuche bei Wikimedia Commons')} (freie Lizenzen, je Datei angegeben)</p>`;
}

function birdCard(entry, region, ctx) {
  const bird = entry.bird;
  const heading = bird.title || bird.name;
  const photoSrc = ctx.photos.get(bird.id);
  const slides = [];
  if (bird.plate) slides.push(`<figure class="slide">${bird.plate.svg}</figure>`);
  if (photoSrc) {
    slides.push(`<figure class="slide photo"><img src="${esc(ctx.base + photoSrc)}" alt="${esc(`Foto: ${bird.photo.caption}`)}" loading="lazy" decoding="async"></figure>`);
  }
  if (!slides.length) slides.push(`<figure class="slide">${placeholderPlate(heading)}</figure>`);
  const tabs = bird.plate && photoSrc
    ? `<div class="tabs" role="group" aria-label="Ansicht wählen" hidden><button type="button" aria-pressed="true">Zeichnung</button><button type="button" aria-pressed="false">Foto</button></div>\n`
    : '';

  const names = bird.english
    ? `<p class="names">${esc(bird.english)} · <i>${esc(bird.scientific)}</i></p>`
    : `<p class="names"><i>${esc(bird.scientific)}</i></p>`;
  const marks = bird.marks?.length ? `<ol class="marks">${bird.marks.map((m) => `<li>${inline(m)}</li>`).join('')}</ol>\n` : '';
  const behavior = bird.behavior ? `<p class="txt"><span class="k">Verhalten</span>${inline(bird.behavior)}</p>\n` : '';
  const regional = entry.text ? `<p class="txt"><span class="k">${esc(region.local_heading || `Auf ${region.name}`)}</span>${inline(entry.text)}</p>\n` : '';
  const xc = bird.xenocanto || bird.english || bird.scientific;
  const links = [link(`https://xeno-canto.org/explore?query=${queryValue(xc)}`, 'Rufe bei xeno-canto')];
  for (const l of bird.links || []) links.push(link(l.url, esc(l.title)));

  return `<article class="bird" id="${esc(bird.id)}"${entry.group ? ` data-group="${esc(entry.group)}"` : ''}>
<div class="media"><div class="slides"${slides.length > 1 ? ` role="group" aria-label="${esc(`Zeichnung und Foto: ${heading}`)}" tabindex="0"` : ''}>${slides.join('')}</div></div>
${tabs}${creditHtml(bird)}
<div class="bird-body">
${entry.local ? `<p class="local">vor Ort: <strong>${esc(entry.local)}</strong></p>\n` : ''}<h3>${esc(heading)}</h3>
${names}
${chipsHtml(entry, bird)}${marks}${behavior}${regional}<p class="links">${links.join('')}</p>
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
          const birds = (s.birds || [])
            .map((id) => region.entries.find((e) => e.id === id))
            .filter(Boolean)
            .map((e) => `<li><a href="#${esc(e.id)}" data-bird>${esc(e.bird.name)}</a></li>`)
            .join('');
          return `<li class="site"><span class="num" aria-hidden="true">${i + 1}</span>
<div><h3>${esc(s.name)}</h3>${s.tagline ? `<p class="tag">${inline(s.tagline)}</p>` : ''}${s.text ? `<p>${inline(s.text)}</p>` : ''}${birds ? `\n<ul class="site-birds" aria-label="Typische Arten">${birds}</ul>` : ''}</div></li>`;
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
<h3>${esc(region.season?.title || 'Das Vogeljahr')}</h3>
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
    const items = (g.species || [])
      .filter(Boolean)
      .map((s) => {
        const detail = [s.en && esc(s.en), s.sci && `<i>${esc(s.sci)}</i>`, s.local && esc(s.local)].filter(Boolean).join(' · ');
        return `<li><strong>${esc(s.name)}</strong>${detail ? `<span>${detail}</span>` : ''}</li>`;
      })
      .join('');
    return `<section class="more"><h3>${esc(g.title)}</h3>${g.note ? `<p class="tag">${inline(g.note)}</p>` : ''}<ul>${items}</ul></section>`;
  })
  .join('\n')}
</div>
</section>`,
  };
}

function photoNote(region, ctx) {
  const birds = region.entries.map((e) => e.bird);
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
  sentences.push('Tonaufnahmen bei xeno-canto tragen ebenfalls je eigene CC-Lizenzen.');
  return sentences.join(' ');
}

function sourcesSection(region, site, ctx) {
  const photos = region.entries.map((e) => e.bird).filter((b) => b.photo);
  const credits = photos.length
    ? `<ul class="credits">\n${photos
        .map((b) => {
          const p = b.photo;
          const license = p.licenseUrl ? link(p.licenseUrl, esc(p.license)) : esc(p.license);
          const source = p.source && p.source !== 'Wikimedia Commons' ? `, ${esc(p.source)}` : '';
          return `<li>${link(p.page, esc(p.caption))}, ${inline(p.author)}, ${license}${source}</li>`;
        })
        .join('\n')}\n</ul>\n`
    : '';

  // Quellen der Region plus Quellen aus den Steckbriefen (ohne Dubletten)
  const list = [];
  const seen = new Set();
  for (const s of [...(region.sources?.list || []), ...region.entries.flatMap((e) => e.bird.sources || [])]) {
    if (!s || seen.has(s.url)) continue;
    seen.add(s.url);
    list.push(s);
  }

  return {
    id: 'quellen',
    nav: 'Quellen',
    html: `<section id="quellen">
<h2>Bilder &amp; Quellen</h2>
${site.drawings_note ? `<p class="note">${inline(site.drawings_note)}</p>\n` : ''}<h3 class="sub">Bildnachweise</h3>
<p class="note">${photoNote(region, ctx)}</p>
${credits}${site.fonts_note ? `<p class="note">${inline(site.fonts_note)}</p>\n` : ''}${
      list.length || region.sources?.note
        ? `<h3 class="sub">Quellen</h3>
${region.sources?.note ? `<p class="note">${inline(region.sources.note)}</p>\n` : ''}${
            list.length ? `<ol class="sources">\n${list.map((s) => `<li>${link(s.url, esc(s.title))}</li>`).join('\n')}\n</ol>\n` : ''
          }`
        : ''
    }</section>`,
  };
}

export function renderRegion(region, site, ctx) {
  const n = region.entries.length;
  const anyPhoto = region.entries.some((e) => ctx.photos.has(e.id));
  const intro = [region.species_intro || site.species_intro, anyPhoto ? site.photo_hint_shown : site.photo_hint_linked]
    .filter(Boolean)
    .map((t) => inline(fill(t, region.vars)))
    .join(' ');

  const species = {
    id: 'arten',
    nav: 'Arten',
    html: `<section id="arten">
<h2>${n} ${plural(n, 'Art', 'Arten')} zum Kennenlernen</h2>
${intro ? `<p class="intro">${intro}</p>\n` : ''}${filters(region)}<div class="grid">
${region.entries.map((e) => birdCard(e, region, ctx)).join('\n')}
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
    url: ctx.siteUrl ? `${ctx.siteUrl}${region.id}/` : null,
  })}
<header class="top"><div class="wrap">
<p class="crumbs"><a href="${ctx.base}">← ${esc(site.title)}</a></p>
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

export function renderIndex(regions, site, ctx) {
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
      return `<li class="region-card"><a href="${ctx.base}${r.id}/">${map}<div class="region-body">
${r.eyebrow ? `<p class="eyebrow">${esc(r.eyebrow)}</p>\n` : ''}<h3>${esc(r.title)}</h3>
${summary ? `<p>${esc(summary)}</p>\n` : ''}<ul class="chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
</div></a></li>`;
    })
    .join('\n');

  return `${head({ title: site.title, description: site.description || site.lead || '', base: ctx.base, assets: ctx.assets, url: ctx.siteUrl || null })}
<header class="top"><div class="wrap">
${site.eyebrow ? `<p class="eyebrow">${esc(site.eyebrow)}</p>\n` : ''}<h1>${esc(site.title)}</h1>
${site.lead ? `<p class="lead">${inline(site.lead)}</p>\n` : ''}<dl class="facts">
${facts.map(([v, l]) => `<div><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>
</div></header>

<main class="wrap">
<section id="regionen">
<h2>${esc(site.regions_title || 'Regionen')}</h2>
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
