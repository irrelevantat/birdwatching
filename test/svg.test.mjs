import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSvg, addPins, svgLabel, sanitizeSvgFile } from '../scripts/lib/svg.mjs';

const SAMPLE = `<?xml version="1.0"?>
<!-- Kommentar -->
<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
<clipPath id="c"><rect width="5" height="5"/></clipPath>
<g clip-path="url(#c)"><rect width="10" height="10" fill="url('#c')"/></g>
<use href="#c"/><use xlink:href="#c"/>
<g class="mk"><text>1</text></g><g class="foo mk"><text>2</text></g>
<script>alert(2)</script>
</svg>`;

test('prepareSvg namespaces ids and references', () => {
  const { svg, markers, warnings } = prepareSvg(SAMPLE, { prefix: 'kolibri', className: 'plate', label: 'Zeichnung' });
  assert.match(svg, /id="kolibri-c"/);
  assert.doesNotMatch(svg, /url\(#c\)|href="#c"/);
  assert.equal((svg.match(/url\(#kolibri-c\)/g) || []).length, 2);
  assert.equal((svg.match(/href="#kolibri-c"/g) || []).length, 2);
  assert.equal(markers, 2);
  assert.ok(warnings.some((w) => w.includes('<script>')));
});

test('prepareSvg strips scripts, handlers, comments and the XML prolog', () => {
  const { svg } = prepareSvg(SAMPLE, { prefix: 'x', className: 'plate', label: 'L' });
  assert.doesNotMatch(svg, /<script|onload|<\?xml|<!--/);
  assert.match(svg, /^<svg class="plate" /);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="L"/);
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
});
