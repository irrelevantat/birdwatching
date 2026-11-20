// Testet den Foto-Download gegen einen lokalen Ersatz-Server statt Wikimedia Commons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fetchPhotos, fetchIllustrations, retryAfterMs } from '../scripts/lib/photos.mjs';
import { loadContent } from '../scripts/lib/content.mjs';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-foto-'));
  const files = {
    'content/site.yml': 'title: Test\n',
    'content/birds/gut/bird.yml': 'name: Gut\nscientific: A b\nphoto:\n  file: Good_bird.jpg\n  author: Jane Doe\n  license: CC BY-SA 4.0\n',
    'content/birds/fehlt/bird.yml': 'name: Fehlt\nscientific: C d\nphoto:\n  file: Missing.jpg\n  author: X\n  license: CC BY 4.0\n',
    'content/regions/r/region.yml': 'name: R\ntitle: R\nbirds:\n  - id: gut\n  - id: fehlt\n',
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

function mockCommons() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push({ path: url.pathname, ua: req.headers['user-agent'], titles: url.searchParams.get('titles'), width: url.searchParams.get('iiurlwidth') });
    if (url.pathname === '/w/api.php') {
      const title = url.searchParams.get('titles');
      const page = title === 'File:Good bird.jpg'
        ? {
            title,
            imageinfo: [{
              thumburl: `http://127.0.0.1:${server.address().port}/thumb/good.jpg`,
              url: 'unused',
              mime: 'image/jpeg',
              extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: '<a href="https://example.org">Jane Doe</a>' } },
            }],
          }
        : { title, missing: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ query: { pages: [page] } }));
      return;
    }
    if (url.pathname === '/thumb/good.jpg') {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(JPEG);
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, requests })));
}

test('downloads photos, records their source and reports metadata differences', async () => {
  const dir = fixture();
  const { server, requests } = await mockCommons();
  const api = `http://127.0.0.1:${server.address().port}/w/api.php`;
  const lines = [];
  try {
    const r = await fetchPhotos({ root: dir, api, pause: 0, delay: 1, log: (l) => lines.push(l), userAgent: 'test-agent' });
    assert.equal(r.loaded, 1);
    assert.equal(r.failed, 1);
    assert.deepEqual(fs.readFileSync(path.join(dir, 'content/birds/gut/photo.jpg')), JPEG);
    assert.equal(fs.readFileSync(path.join(dir, 'content/birds/gut/.photo-source'), 'utf8'), 'Good bird.jpg\n');
    const log = lines.join('\n');
    assert.match(log, /Lizenz auf Commons: „CC BY 4.0“, im Steckbrief: „CC BY-SA 4.0“/);
    assert.doesNotMatch(log, /Urheber auf Commons/);
    assert.match(log, /„Missing.jpg“ gibt es auf Commons nicht/);
    assert.ok(requests.every((q) => q.ua === 'test-agent'));
    assert.ok(requests.filter((q) => q.path === '/w/api.php').every((q) => q.width === '960'));

    // Seite verwendet das Foto
    assert.ok(loadContent(dir).birds.get('gut').photo.local);

    // Ändert sich die Datei in bird.yml, gilt das alte Foto als veraltet …
    fs.writeFileSync(path.join(dir, 'content/birds/gut/bird.yml'), 'name: Gut\nscientific: A b\nphoto:\n  file: Other.jpg\n  author: Jane Doe\n  license: CC BY 4.0\n');
    const stale = loadContent(dir);
    assert.equal(stale.birds.get('gut').photo.local, null);
    assert.match(stale.warnings.map((w) => w.message).join('\n'), /stammt von „Good bird.jpg“/);
    // … und wird beim nächsten Lauf erneut angefragt
    requests.length = 0;
    await fetchPhotos({ root: dir, api, pause: 0, delay: 1, log: () => {} });
    assert.ok(requests.some((q) => q.titles === 'File:Other.jpg'));
  } finally {
    server.close();
  }
});

test('gives up quickly when Commons is unreachable', async () => {
  const dir = fixture();
  const lines = [];
  const started = Date.now();
  const r = await fetchPhotos({ root: dir, api: 'http://127.0.0.1:9/w/api.php', pause: 0, log: (l) => lines.push(l) });
  assert.equal(r.loaded, 0);
  assert.ok(r.offline || r.failed === 2);
  assert.ok(Date.now() - started < 5000, 'sollte ohne lange Wartezeiten abbrechen');
});

test('Retry-After is understood as seconds or HTTP date', () => {
  assert.equal(retryAfterMs('5'), 5000);
  assert.equal(retryAfterMs('Wed, 21 Oct 2026 07:28:05 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT')), 5000);
  assert.equal(retryAfterMs(null), null);
  assert.equal(retryAfterMs('quatsch'), null);
});

test('waits and retries when Commons answers 429', async () => {
  const dir = fixture();
  let calls = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/w/api.php') {
      calls++;
      if (calls === 1) {
        res.writeHead(429, { 'Retry-After': '0' });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ query: { pages: [{ title: url.searchParams.get('titles'), missing: true }] } }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await fetchPhotos({ root: dir, api: `http://127.0.0.1:${server.address().port}/w/api.php`, pause: 0, delay: 1, log: () => {}, only: ['gut'] });
    assert.equal(calls, 2);
  } finally {
    server.close();
  }
});

test('downloads SVG illustrations in full size, cleans them and refuses other formats', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vogel-grafik-'));
  const files = {
    'content/site.yml': 'title: Test\n',
    'content/birds/gut/bird.yml': 'name: Gut\nscientific: A b\nillustration:\n  file: Good bird.svg\n  author: Jane Doe\n  license: CC BY 4.0\n',
    'content/birds/png/bird.yml': 'name: Png\nscientific: C d\nillustration:\n  file: Bitmap.png\n  author: X\n  license: CC0\n',
    'content/regions/r/region.yml': 'name: R\ntitle: R\nbirds:\n  - id: gut\n  - id: png\n',
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push({ path: url.pathname, width: url.searchParams.get('iiurlwidth') });
    if (url.pathname === '/w/api.php') {
      const title = url.searchParams.get('titles');
      const svg = title === 'File:Good bird.svg';
      const page = {
        title,
        imageinfo: [{
          url: `http://127.0.0.1:${server.address().port}/orig/${svg ? 'good.svg' : 'bitmap.png'}`,
          mime: svg ? 'image/svg+xml' : 'image/png',
          extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'Jane Doe' } },
        }],
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ query: { pages: [page] } }));
      return;
    }
    if (url.pathname === '/orig/good.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg viewBox="0 0 1 1"><script>alert(1)</script><rect width="1" height="1"/></svg>');
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const lines = [];
  try {
    const r = await fetchIllustrations({ root: dir, api: `http://127.0.0.1:${server.address().port}/w/api.php`, pause: 0, delay: 1, log: (l) => lines.push(l) });
    assert.equal(r.loaded, 1);
    assert.equal(r.failed, 1);
    const saved = fs.readFileSync(path.join(dir, 'content/birds/gut/illustration.svg'), 'utf8');
    assert.equal(saved, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
    assert.equal(fs.readFileSync(path.join(dir, 'content/birds/gut/.illustration-source'), 'utf8'), 'Good bird.svg\n');
    assert.ok(!fs.existsSync(path.join(dir, 'content/birds/png/illustration.svg')));
    const log = lines.join('\n');
    assert.match(log, /„Bitmap\.png“ ist keine passende Datei \(image\/png/);
    assert.match(log, /Bitte beide Dateien committen/);
    // Originalgröße: keine Vorschau-Breite anfragen, das Bild selbst nicht doppelt laden
    assert.ok(requests.filter((q) => q.path === '/w/api.php').every((q) => q.width === null));
    assert.ok(!requests.some((q) => q.path === '/orig/bitmap.png'));
    assert.ok(loadContent(dir).birds.get('gut').illustration.local);
  } finally {
    server.close();
  }
});
