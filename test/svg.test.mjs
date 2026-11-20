import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSvg, addPins, svgLabel, sanitizeSvgFile } from '../scripts/lib/svg.mjs';

const SAMPLE = `<?xml version="1.0"?>
<!-- Kommentar -->
<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
<clipPath id="c"><rect width="5" height="5"/></clipPath>
<g clip-path="url(#c)"><rect width="10" height="10" fill="url('#c')"/></g>
<use href="#c"/><use xlink:href='#c'/>
<g class="mk"><text>1</text></g><g class="foo mk"><text>2</text></g>
</svg>`;

test('prepareSvg namespaces ids and references', () => {
  const { svg, markers } = prepareSvg(SAMPLE, { prefix: 'kolibri', className: 'plate', label: 'Zeichnung' });
  assert.match(svg, /id="kolibri--c"/);
  assert.doesNotMatch(svg, /url\(#c\)|href="#c"|href='#c'/);
  assert.equal((svg.match(/url\(#kolibri--c\)/g) || []).length, 2);
  assert.equal((svg.match(/href=["']#kolibri--c["']/g) || []).length, 2);
  assert.equal(markers, 2);
});

test('prepareSvg strips comments and the XML prolog and sets root attributes', () => {
  const { svg } = prepareSvg(SAMPLE, { prefix: 'x', className: 'plate', label: 'L' });
  assert.doesNotMatch(svg, /<\?xml|<!--/);
  assert.match(svg, /^<svg class="plate" /);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="L"/);
});

test('prepareSvg rejects active content instead of silently repairing it', () => {
  const opts = { prefix: 'p', className: 'plate', label: 'x' };
  for (const bad of [
    '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 1 1"><script/></svg>',
    '<svg viewBox="0 0 1 1" onload="alert(1)"></svg>',
    '<svg viewBox="0 0 1 1"><rect/onclick=alert(1)/></svg>',
    '<svg viewBox="0 0 1 1"><a href=" javascript:alert(1)"><text>x</text></a></svg>',
    '<svg viewBox="0 0 1 1"><foreignObject><div/></foreignObject></svg>',
    // HTML-Ausbruch aus dem SVG
    '<svg viewBox="0 0 1 1"><p></p><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe></svg>',
    // kodierte javascript:-Links
    '<svg viewBox="0 0 1 1"><use href="&#106;avascript:alert(1)"/></svg>',
    '<svg viewBox="0 0 1 1"><use href="java&#9;script:alert(1)"/></svg>',
    '<svg viewBox="0 0 1 1"><use href="jav&#x61;script:alert(1)"/></svg>',
    '<svg viewBox="0 0 1 1"><use href="javascript&colon;alert(1)"/></svg>',
    '<svg viewBox="0 0 1 1"><use href="java\nscript:alert(1)"/></svg>',
    // Animation, die einen Link setzt, und Links überhaupt
    '<svg viewBox="0 0 1 1"><a><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>',
    '<svg viewBox="0 0 1 1"><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    // externe Dateien
    '<svg viewBox="0 0 1 1"><image href="https://example.org/x.png"/></svg>',
    '<svg viewBox="0 0 1 1"><rect fill="url(https://example.org/p.svg#a)"/></svg>',
    '<svg viewBox="0 0 1 1"><rect style="fill:url(&quot;https://example.org/a&quot;)"/></svg>',
    '<svg viewBox="0 0 1 1"><style>@import url(https://example.org/a.css);</style></svg>',
  ]) {
    assert.throws(() => prepareSvg(bad, opts), /nicht erlaubt|Erlaubt ist nur reine Vektorgrafik/, bad);
  }
});

test('prepareSvg accepts legitimate drawing features and editor output', () => {
  const opts = { prefix: 'p', className: 'plate', label: 'x' };
  const inkscape = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" viewBox="0 0 10 10" inkscape:version="1.3">
<sodipodi:namedview id="nv" pagecolor="#ffffff"><inkscape:page x="0" y="0"/></sodipodi:namedview>
<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient><filter id="f"><feGaussianBlur stdDeviation="1"/></filter></defs>
<g inkscape:label="Ebene 1" inkscape:groupmode="layer"><rect fill="url(#g)" filter="url(#f)" style="stroke:url(#g)"/><use href="#g"/><text>Ein on-Wort: one = 1</text></g>
<style><![CDATA[ .x { fill: red } ]]></style>
</svg>`;
  const { svg } = prepareSvg(inkscape, opts);
  assert.doesNotMatch(svg, /sodipodi:namedview|inkscape:page/);
  assert.match(svg, /<!\[CDATA\[ \.x \{ fill: red \} \]\]>/, 'CDATA bleibt erhalten');
  assert.match(svg, /fill="url\(#p--g\)"/);
});

test('prepareSvg reports a missing closing quote', () => {
  const opts = { prefix: 'p', className: 'plate', label: 'x' };
  assert.throws(() => prepareSvg('<svg viewBox="0 0 1 1">\n<rect fill="#000/>\n<circle r="1"/>\n</svg>', opts), /Anführungszeichen|nicht vollständig/);
});

test('prepareSvg reports unclosed elements with a line number', () => {
  const opts = { prefix: 'p', className: 'plate', label: 'x' };
  assert.throws(() => prepareSvg('<svg viewBox="0 0 1 1">\n<g>\n<rect/>\n</svg>', opts), /<g> \(Zeile 2\) wird nicht geschlossen/);
  assert.throws(() => prepareSvg('<svg viewBox="0 0 1 1">\n<rect>\n</svg>', opts), /<rect>/);
});

test('prepareSvg handles labels with $ and attributes containing >', () => {
  const { svg } = prepareSvg('<svg data-x="a>b" aria-label="alt" viewBox="0 0 1 1"><rect/></svg>', { prefix: 'p', className: 'plate', label: 'Kosten $& mehr' });
  assert.match(svg, /^<svg class="plate" data-x="a>b" aria-label="Kosten \$&amp; mehr"/);
});

test('prepareSvg merges existing class and replaces aria-label', () => {
  const { svg } = prepareSvg('<svg class="a" aria-label="alt" viewBox="0 0 1 1"></svg>', { prefix: 'p', className: 'map', label: 'Neu & gut' });
  assert.match(svg, /class="map a"/);
  assert.match(svg, /aria-label="Neu &amp; gut"/);
});

test('prepareSvg rejects non-SVG content', () => {
  assert.throws(() => prepareSvg('<html></html>', { prefix: 'p', className: 'plate', label: 'x' }), /beginnt nicht mit <svg/);
});

test('svgLabel reads the aria-label', () => {
  assert.equal(svgLabel('<svg aria-label="Karte &amp; Orte"></svg>'), 'Karte & Orte');
  assert.equal(svgLabel('<svg></svg>'), null);
});

test('addPins appends numbered markers', () => {
  const out = addPins('<svg viewBox="0 0 1 1"></svg>', [{ n: 3, x: 242, y: 169.6 }]);
  assert.match(out, /<circle cx="242" cy="169.6" r="10.5"/);
  assert.match(out, /<text x="242" y="173.8" text-anchor="middle" class="t-pin">3<\/text><\/svg>$/);
  assert.doesNotMatch(out, /<a\b/);
});

test('addPins turns markers with href into links', () => {
  const out = addPins('<svg viewBox="0 0 1 1"></svg>', [
    { n: 1, x: 10, y: 20, href: '#charco-verde', label: '1: Charco & "Verde"' },
    { n: 2, x: 30, y: 40, href: '#rio' },
    { n: 3, x: 50, y: 60 },
  ]);
  // Mit Beschriftung: Link um Kreis und Nummer, Beschriftung escaped
  assert.match(
    out,
    /<a href="#charco-verde" class="pin" aria-label="1: Charco &amp; &quot;Verde&quot;"><circle cx="10" cy="20" r="10\.5"[^>]*\/><text x="10" y="24\.2" text-anchor="middle" class="t-pin">1<\/text><\/a>/,
  );
  // Ohne Beschriftung: Link ohne aria-label
  assert.match(out, /<a href="#rio" class="pin"><circle cx="30" cy="40"/);
  // Ohne href: unverändert wie bisher
  assert.match(out, /<\/a><circle cx="50" cy="60" r="10\.5"[^>]*\/><text x="50" y="64\.2" text-anchor="middle" class="t-pin">3<\/text><\/svg>$/);
  assert.equal((out.match(/<a /g) || []).length, 2);
  // href wird escaped
  assert.match(addPins('<svg></svg>', [{ n: 1, x: 0, y: 0, href: '#a"b' }]), /<a href="#a&quot;b" class="pin">/);
});

test('sanitizeSvgFile removes executable content and adds the SVG namespace', () => {
  const { svg, warnings } = sanitizeSvgFile(
    '<?xml version="1.0"?>\n<svg width="4" height="4"><script>a()</script><script src="x.js"/><foreignObject><div/></foreignObject><a xlink:href="javascript:b()"><rect onload="c()"/></a></svg>',
  );
  assert.doesNotMatch(svg, /<script|foreignObject|javascript:|onload/);
  assert.match(svg, /<a xlink:href="#"><rect\/><\/a><\/svg>$/);
  assert.match(svg, /^<\?xml version="1\.0"\?>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="4"/);
  assert.equal(warnings.length, 1);
  assert.equal(sanitizeSvgFile('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>').warnings.length, 0);
  assert.throws(() => sanitizeSvgFile('<html></html>'), /Keine gültige SVG-Datei/);
  // Inkscape-Dateien enden manchmal mit „</svg\n>“
  assert.equal(sanitizeSvgFile('<svg\n  xmlns="http://www.w3.org/2000/svg"\n  viewBox="0 0 1 1"\n></svg\n>\n').warnings.length, 0);
});
