#!/usr/bin/env node
// Lokale Vorschau: baut die Seite (inkl. Entwürfe), startet einen Webserver
// und baut bei jeder Änderung in content/, assets/ oder scripts/ neu.
// Der Browser lädt danach automatisch neu.
//
//   npm run dev               → http://localhost:8080
//   PORT=3000 npm run dev     → anderer Port

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

// Nur in der Vorschau: automatisches Neuladen und Alt+Klick auf Karte oder Zeichnung
// zeigt die Koordinaten (für pin: [x, y] in region.yml und Markierungen in plate.svg).
const RELOAD = `<script>(function(){
var s=new EventSource('/__reload');s.onmessage=function(){location.reload()};
var tip;document.addEventListener('click',function(e){
var svg=e.target.closest&&e.target.closest('svg.map,svg.plate');if(!svg||!e.altKey)return;e.preventDefault();
var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var p=pt.matrixTransform(svg.getScreenCTM().inverse());
var txt='['+Math.round(p.x)+', '+Math.round(p.y)+']';if(navigator.clipboard)navigator.clipboard.writeText(txt).catch(function(){});
if(!tip){tip=document.createElement('div');tip.style.cssText='position:fixed;z-index:99;left:50%;bottom:20px;transform:translateX(-50%);background:#18211d;color:#fff;font:600 14px system-ui;padding:8px 14px;border-radius:8px';document.body.appendChild(tip);}
tip.textContent='Koordinaten '+txt+' (in die Zwischenablage kopiert)';clearTimeout(tip.t);tip.t=setTimeout(function(){tip.remove();tip=null},4000);
},true);})();</script>`;
const clients = new Set();

function rebuild() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs'), '--drafts'], { cwd: ROOT, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) for (const res of clients) res.write('data: reload\n\n');
      resolve(code);
    });
  });
}

function send(res, status, file) {
  const ext = path.extname(file).toLowerCase();
  let body = fs.readFileSync(file);
  if (ext === '.html') body = Buffer.from(body.toString('utf8').replace('</body>', `${RELOAD}</body>`));
  res.writeHead(status, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': verbunden\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let p;
  try {
    p = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = path.join(OUT, p);
  if (file !== OUT && !file.startsWith(OUT + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) {
      res.writeHead(301, { Location: p + '/' });
      res.end();
      return;
    }
    file = path.join(file, 'index.html');
  }
  if (fs.existsSync(file)) return send(res, 200, file);
  const notFound = path.join(OUT, '404.html');
  if (fs.existsSync(notFound)) return send(res, 404, notFound);
  res.writeHead(404).end('Nicht gefunden');
});

let timer = null;
let running = false;
let again = false;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    do {
      again = false;
      await rebuild();
    } while (again);
    running = false;
  }, 150);
}

await rebuild();
for (const dir of ['content', 'assets', 'scripts']) {
  fs.watch(path.join(ROOT, dir), { recursive: true }, schedule);
}
server.listen(PORT, () => {
  console.log(`\nVorschau: http://localhost:${PORT}/  (Strg+C beendet)\n`);
});
