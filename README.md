# Vogel- und Schmetterlingsführer

Regionale Naturführer als statische Website für GitHub Pages: typische Arten mit
Bestimmungszeichnungen, eine Karte mit Beobachtungsorten, das Jahr im Überblick und
Tipps. Oben auf jeder Seite wählt man die **Tiergruppe** (Vögel oder
Schmetterlinge); jede hat eigene Seiten, gemischt wird nicht. Wer ein Tier gesehen
hat, sortiert die Arten mit **„Vogel gesehen?“** bzw. **„Schmetterling gesehen?“**
nach Monat, Größe, Ort und Farben. Die erste Region ist **Ometepe** (Nicaraguasee)
mit 72 Vogel- und 18 Schmetterlingsarten.

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
| `… --type schmetterlinge` | Dasselbe für Schmetterlinge (bei `neue-art` und `neue-region`) |
| `npm run fotos` | Lädt die angegebenen Fotos von Wikimedia Commons herunter |
| `npm run grafiken` | Lädt CC-lizenzierte SVG-Illustrationen von Commons ins Repository |

Die ausführliche Anleitung mit allen Feldern steht in **[ANLEITUNG.md](ANLEITUNG.md)**.

## Aufbau

```
content/
  site.yml                          Einstellungen und Texte der Website (je Tiergruppe)
  birds/<art>/bird.yml              Steckbrief eines Vogels (gilt für alle Regionen)
  birds/<art>/plate.svg             Bestimmungszeichnung mit nummerierten Merkmalen
  birds/<art>/illustration.svg      optional: CC-lizenzierte SVG-Grafik (liegt im Repository)
  birds/<art>/photo.jpg             optional: Foto (von „npm run fotos“ geladen)
  butterflies/<art>/butterfly.yml   Steckbrief eines Schmetterlings (Zeichnung, Foto wie oben)
  regions/<region>/region.yml       Vögel der Region: Arten, Orte, Jahreszeiten, Tipps, Quellen
  regions/<region>/butterflies.yml  Schmetterlinge der Region (gleiche Felder)
  regions/<region>/map.svg          optional: schematische Karte (für alle Tiergruppen)
vorlagen/                           Vorlagen für neue Arten, Regionen, Zeichnungen, Karten
assets/                             Stylesheet, Skript, Schriften, Favicon
scripts/                            Build, Vorschau, Foto- und Grafik-Download, Gerüst-Skripte
scripts/lib/kinds.mjs               Tiergruppen (Ordner, Dateinamen, Größenklassen, Wörter)
test/                               Tests
```

Eine Art wird einmal unter `content/birds/` bzw. `content/butterflies/` beschrieben
und kann in beliebig vielen Regionen vorkommen. Was nur für eine Region gilt (Name vor
Ort, Status, wo man sie findet), steht in der Regionsdatei. Vögel erscheinen unter
`…/<region>/`, Schmetterlinge unter `…/schmetterlinge/<region>/`.

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

- Texte, Vogel- und Falterzeichnungen und Karte wurden mit KI (Claude) erstellt.
- Fotos stammen von Wikimedia Commons oder iNaturalist und stehen unter der jeweils
  genannten Creative-Commons-Lizenz; Urheber und Lizenz stehen auf der Seite bei
  jedem Foto.
- Illustrationen (`illustration.svg`) stammen von Dritten und stehen unter der in
  der jeweiligen `bird.yml` genannten freien Lizenz; die Seite nennt Urheber und
  Lizenz bei jeder Grafik.
- Schriften: Bricolage Grotesque und Source Serif 4 unter der SIL Open Font
  License 1.1 (Lizenztexte in [`assets/fonts/`](assets/fonts/)).
