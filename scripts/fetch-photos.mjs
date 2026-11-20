#!/usr/bin/env node
// Lädt die in bird.yml angegebenen Fotos von Wikimedia Commons herunter
// (verkleinert auf 960 px Breite) und legt sie als photo.jpg in den Ordner der Art.
// Dann zeigt die Seite das Foto selbst an (Umschalter „Zeichnung / Foto“),
// ohne dass Besucher Bilder von fremden Servern laden.
//
//   npm run fotos                 fehlende Fotos laden
//   npm run fotos -- --force      alle Fotos neu laden
//   npm run fotos -- kolibri      nur bestimmte Arten (Ordnernamen)
//
// Das Skript endet immer erfolgreich: Ist Commons nicht erreichbar, bleibt es
// beim Link auf das Foto. Es prüft außerdem, ob Urheber und Lizenz in bird.yml
// zu den Angaben auf Commons passen, und meldet Abweichungen.
//
// Wikimedia bittet um einen aussagekräftigen User-Agent mit Kontaktmöglichkeit:
//   PHOTO_USER_AGENT="mein-vogelfuehrer/1.0 (https://github.com/…)" npm run fotos

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPhotos } from './lib/photos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

await fetchPhotos({
  root: ROOT,
  force: args.includes('--force'),
  only: args.filter((a) => !a.startsWith('--')),
  ...(process.env.PHOTO_USER_AGENT ? { userAgent: process.env.PHOTO_USER_AGENT } : {}),
});
