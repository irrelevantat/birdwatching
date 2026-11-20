import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, inline, parseMonths, fill, numberWord, queryValue, suggest } from '../scripts/lib/text.mjs';

test('esc escapes HTML-relevant characters', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&lt;/a&gt;');
});

test('inline: links, bold, italics', () => {
  assert.equal(inline('[SIL OFL](https://openfontlicense.org)'), '<a href="https://openfontlicense.org" rel="noopener">SIL OFL</a>');
  assert.equal(inline('**Früh raus.** und *Ara macao*'), '<strong>Früh raus.</strong> und <i>Ara macao</i>');
  assert.equal(inline('[Anker](#fischadler)'), '<a href="#fischadler">Anker</a>');
});

test('inline: escapes raw HTML and refuses dangerous links', () => {
  assert.equal(inline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.ok(!inline('[x](javascript:alert(1))').includes('<a'));
  assert.ok(!inline('[x](data:text/html,hi)').includes('<a'));
});

test('inline: leaves ordinary text alone', () => {
  assert.equal(inline('Fernglas (8×42) – 2 * 3 * 4'), 'Fernglas (8×42) – 2 * 3 * 4');
  assert.equal(inline('„Wächter der Schlucht“'), '„Wächter der Schlucht“');
});

test('parseMonths: ranges across the year end, lists, single months', () => {
  assert.deepEqual([...parseMonths('11-4')].sort((a, b) => a - b), [1, 2, 3, 4, 11, 12]);
  assert.deepEqual([...parseMonths('5-10')].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10]);
  assert.deepEqual([...parseMonths([12, 1, 2])].sort((a, b) => a - b), [1, 2, 12]);
  assert.deepEqual([...parseMonths(7)], [7]);
  assert.deepEqual([...parseMonths('3, 6-7')].sort((a, b) => a - b), [3, 6, 7]);
  assert.throws(() => parseMonths('13'), /kein Monat/);
  assert.throws(() => parseMonths(''), /fehlen/);
  assert.throws(() => parseMonths(undefined), /fehlen/);
});

test('fill replaces known placeholders only', () => {
  assert.equal(fill('{arten} Arten, {orte} Orte, {x}', { arten: 18, orte: 5 }), '18 Arten, 5 Orte, {x}');
});

test('numberWord', () => {
  assert.equal(numberWord(4), 'vier');
  assert.equal(numberWord(1), 'eine');
  assert.equal(numberWord(1, { one: 'einem' }), 'einem');
  assert.equal(numberWord(20), '20');
});

test('queryValue encodes like the original links', () => {
  assert.equal(queryValue("Hoffmann's Woodpecker"), 'Hoffmann%27s+Woodpecker');
  assert.equal(queryValue('Trogon melanocephalus'), 'Trogon+melanocephalus');
});

test('suggest finds close matches', () => {
  assert.equal(suggest('behaviour', ['behavior', 'marks', 'name']), 'behavior');
  assert.equal(suggest('wlad', ['wald', 'wasser']), 'wald');
  assert.equal(suggest('xyz', ['wald', 'wasser']), null);
});
