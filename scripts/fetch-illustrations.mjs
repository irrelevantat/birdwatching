#!/usr/bin/env node
// Lädt die in bird.yml unter „illustration“ angegebenen SVG-Grafiken von
// Wikimedia Commons herunter und legt sie als illustration.svg in den Ordner der
// Art. Anders als Fotos gehören diese Dateien ins Repository: Nach dem Laden
// illustration.svg und .illustration-source committen.
//
//   npm run grafiken                     fehlende Grafiken laden
//   npm run grafiken -- --force          alle Grafiken neu laden
//   npm run grafiken -- fischadler       nur bestimmte Arten (Ordnernamen)
//
// Das Skript prüft, ob Urheber und Lizenz in bird.yml zu den Angaben auf Commons
// passen, und entfernt aus den Dateien alles Ausführbare (Skripte, Event-Handler).
//
// Wikimedia bittet um einen aussagekräftigen User-Agent mit Kontaktmöglichkeit:
//   PHOTO_USER_AGENT="mein-vogelfuehrer/1.0 (https://github.com/…)" npm run grafiken

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchIllustrations } from './lib/photos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

await fetchIllustrations({
  root: ROOT,
  force: args.includes('--force'),
  only: args.filter((a) => !a.startsWith('--')),
  ...(process.env.PHOTO_USER_AGENT ? { userAgent: process.env.PHOTO_USER_AGENT } : {}),
});
