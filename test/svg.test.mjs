import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSvg, addPins, svgLabel } from '../scripts/lib/svg.mjs';

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
  ]) {
    assert.throws(() => prepareSvg(bad, opts), /nicht erlaubt/, bad);
  }
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
});
