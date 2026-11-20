# Vogelführer

Regionale Vogelführer als statische Website für GitHub Pages. Im Mittelpunkt jeder
Region steht **„Vogel gesehen?“**: Wer einen Vogel gesehen hat, tippt Farben,
Größe, Lebensraum, Ort und Monat an, und die passendsten Arten rücken nach oben.
Jede Art hat einen Steckbrief mit Bestimmungszeichnung; dazu kommen Seiten für
Karte und Beobachtungsorte, Vogeljahr und Tipps, weitere Arten und Quellen. Die
erste Region ist **Ometepe** (Nicaraguasee) mit 18 Arten.

Alle Inhalte sind einfache Textdateien (YAML) und Zeichnungen (SVG). Daraus baut
ein kleines Node.js-Skript die Seiten. Neue Arten und Regionen brauchen keinen
Programmcode.

## Schnellstart

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
npm run dev        # Vorschau auf http://localhost:8080, lädt bei Änderungen neu
```

| Befehl | Was es tut |
| --- | --- |
| `npm run dev` | Lokale Vorschau mit automatischem Neuladen (zeigt auch Entwürfe und Fehler). Anderer Port: `PORT=3000 npm run dev` |
| `npm run build` | Baut die Website nach `_site/` und prüft alle Inhalte |
| `npm test` | Automatische Tests |
| `npm run neue-art -- "Grünreiher" --region ometepe --group wasser` | Legt eine Art an und trägt sie in eine Region ein |
| `npm run neue-region -- "Neusiedler See"` | Legt eine neue Region an (zunächst als Entwurf) |
| `npm run fotos` | Lädt die angegebenen Fotos von Wikimedia Commons herunter |
| `npm run grafiken` | Lädt CC-lizenzierte SVG-Illustrationen von Commons ins Repository |

Die ausführliche Anleitung mit allen Feldern steht in **[ANLEITUNG.md](ANLEITUNG.md)**.

## Aufbau

```
content/
  site.yml                     Einstellungen und Standardtexte der Website
  birds/<art>/bird.yml         Steckbrief einer Art (gilt für alle Regionen)
  birds/<art>/plate.svg        Bestimmungszeichnung mit nummerierten Merkmalen
  birds/<art>/illustration.svg optional: CC-lizenzierte SVG-Grafik (liegt im Repository)
  birds/<art>/photo.jpg        optional: Foto (mit „npm run fotos“ laden und committen)
  regions/<region>/region.yml  Region: Arten, Lebensräume, Orte, Jahreszeiten, Tipps, Quellen
  regions/<region>/map.svg     optional: schematische Karte
vorlagen/                      Vorlagen für neue Arten, Regionen, Zeichnungen, Karten
assets/                        Stylesheet, Skript, Schriften, Favicon
scripts/                       Build, Vorschau, Foto- und Grafik-Download, Gerüst-Skripte
test/                          Tests
```

Eine Art wird einmal unter `content/birds/` beschrieben und kann in beliebig
vielen Regionen vorkommen. Was nur für eine Region gilt (Name vor Ort, Status,
Lebensraum, wo man sie findet), steht in der `region.yml`.

Daraus entstehen je Region diese Seiten (z. B. `…/ometepe/`):

```
<region>/                 „Vogel gesehen?“ und alle Arten, nach Lebensraum geordnet
<region>/arten/<art>/     Steckbrief einer Art
<region>/orte/            Karte und Beobachtungsorte
<region>/wann-und-wie/    Vogeljahr und Tipps
<region>/weitere-arten/   Arten ohne eigenen Steckbrief
<region>/quellen/         Bildnachweise und Quellen
```

Unterseiten ohne Inhalt entfallen. Am Handy steht das Menü als Leiste am unteren
Rand, damit „Vogel gesehen?“ von jeder Seite aus erreichbar ist.

## Veröffentlichen

Der Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) prüft und
baut die Seite bei jedem Pull Request und jedem Push auf `main`. Auf `main`
veröffentlicht er sie auf GitHub Pages. Fotos, die (noch) nicht im Repository
liegen, lädt er dabei von Wikimedia Commons nach und hebt sie für die nächsten Läufe
auf. Besucher laden so keine Bilder von fremden Servern.

Einmalig im Repository einstellen: **Settings → Pages → Build and deployment →
Source: „GitHub Actions“**. Danach ist die Seite nach jedem Merge auf `main` unter
https://irrelevantat.github.io/birdwatching/ erreichbar. Wurde vor dieser
Einstellung schon gemergt, scheitert der Lauf mit „Get Pages site failed“; dann unter
**Actions → Website → Run workflow** (oder „Re-run all jobs“) neu starten.

## Lizenzen

- Texte, Vogelzeichnungen und Karte wurden mit KI (Claude) erstellt.
- Fotos stammen von Wikimedia Commons und stehen unter der jeweils genannten
  Creative-Commons-Lizenz; Urheber und Lizenz stehen im Steckbrief bei jedem Foto
  und auf der Seite „Bilder & Quellen“ jeder Region.
- Illustrationen (`illustration.svg`) stammen von Dritten und stehen unter der in
  der jeweiligen `bird.yml` genannten freien Lizenz; die Seite nennt Urheber und
  Lizenz bei jeder Grafik.
- Schriften: Bricolage Grotesque und Source Serif 4 unter der SIL Open Font
  License 1.1 (Lizenztexte in [`assets/fonts/`](assets/fonts/)).
