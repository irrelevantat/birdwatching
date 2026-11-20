# Vogelführer

Regionale Vogelführer als statische Website für GitHub Pages: typische Arten mit
Bestimmungszeichnungen, eine Karte mit Beobachtungsorten, das Vogeljahr und
Tipps. Die erste Region ist **Ometepe** (Nicaraguasee) mit 18 Arten.

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

Die ausführliche Anleitung mit allen Feldern steht in **[ANLEITUNG.md](ANLEITUNG.md)**.

## Aufbau

```
content/
  site.yml                    Einstellungen und Standardtexte der Website
  birds/<art>/bird.yml        Steckbrief einer Art (gilt für alle Regionen)
  birds/<art>/plate.svg       Bestimmungszeichnung mit nummerierten Merkmalen
  birds/<art>/photo.jpg       optional: Foto (von „npm run fotos“ geladen)
  regions/<region>/region.yml Region: Arten, Orte, Jahreszeiten, Tipps, Quellen
  regions/<region>/map.svg    optional: schematische Karte
vorlagen/                     Vorlagen für neue Arten, Regionen, Zeichnungen, Karten
assets/                       Stylesheet, Skript, Schriften, Favicon
scripts/                      Build, Vorschau, Foto-Download, Gerüst-Skripte
test/                         Tests
```

Eine Art wird einmal unter `content/birds/` beschrieben und kann in beliebig
vielen Regionen vorkommen. Was nur für eine Region gilt (Name vor Ort, Status,
wo man sie findet), steht in der `region.yml`.

## Veröffentlichen

Der Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) prüft und
baut die Seite bei jedem Pull Request und jedem Push auf `main`. Auf `main`
veröffentlicht er sie auf GitHub Pages. Dabei lädt er auch die Fotos von Wikimedia
Commons (und hebt sie für die nächsten Läufe auf), sodass Besucher keine Bilder von
fremden Servern laden.

Einmalig im Repository einstellen: **Settings → Pages → Build and deployment →
Source: „GitHub Actions“**. Danach ist die Seite nach jedem Merge auf `main` unter
https://irrelevantat.github.io/birdwatching/ erreichbar. Wurde vor dieser
Einstellung schon gemergt, scheitert der Lauf mit „Get Pages site failed“; dann unter
**Actions → Website → Run workflow** (oder „Re-run all jobs“) neu starten.

## Lizenzen

- Texte, Vogelzeichnungen und Karte wurden mit KI (Claude) erstellt.
- Fotos stammen von Wikimedia Commons und stehen unter der jeweils genannten
  Creative-Commons-Lizenz; Urheber und Lizenz stehen auf der Seite bei jedem Foto.
- Schriften: Bricolage Grotesque und Source Serif 4 unter der SIL Open Font
  License 1.1 (Lizenztexte in [`assets/fonts/`](assets/fonts/)).
