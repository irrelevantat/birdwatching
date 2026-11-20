# Vogel- und Schmetterlingsführer

Regionale Naturführer als statische Website für GitHub Pages. Oben auf jeder Seite
wählt man die **Tiergruppe** (Vögel oder Schmetterlinge); jede hat eigene Seiten,
gemischt wird nicht. Im Mittelpunkt jeder Region steht **„Vogel gesehen?“** bzw.
**„Schmetterling gesehen?“**: Wer ein Tier gesehen hat, tippt Farben, Größe,
Lebensraum, Ort und Monat an, und die passendsten Arten rücken nach oben. Jede Art hat
einen Steckbrief mit Bestimmungszeichnung; dazu kommen Seiten für Karte und
Beobachtungsorte, Jahreslauf und Tipps, weitere Arten und Quellen. Die erste Region
ist **Ometepe** (Nicaraguasee) mit 72 Vogel- und 18 Schmetterlingsarten.

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
| `npm run neue-art -- "Kahnschnabel" --region ometepe --group wasser` | Legt eine Art an und trägt sie in eine Region ein |
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
  birds/<art>/photo.jpg             optional: Foto (mit „npm run fotos“ laden und committen)
  birds/<art>/illustration.svg      optional: CC-lizenzierte SVG-Grafik
  butterflies/<art>/butterfly.yml   Steckbrief eines Schmetterlings (Zeichnung, Foto wie oben)
  regions/<region>/region.yml       Vögel der Region: Arten, Lebensräume, Orte, Jahreszeiten, Tipps, Quellen
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
Ort, Status, Lebensraum, wo man sie findet), steht in der Regionsdatei.

Daraus entstehen je Region und Tiergruppe diese Seiten, mit `<region>` = z. B.
`ometepe/` (Vögel) oder `schmetterlinge/ometepe/`:

```
<region>/                 „Vogel gesehen?“ und alle Arten, nach Lebensraum geordnet
<region>/arten/<art>/     Steckbrief einer Art
<region>/orte/            Karte und Beobachtungsorte
<region>/wann-und-wie/    Jahreslauf und Tipps
<region>/weitere-arten/   Arten ohne eigenen Steckbrief
<region>/quellen/         Bildnachweise und Quellen
```

Unterseiten ohne Inhalt entfallen. Die Übersicht der Vögel ist die Startseite, die der
Schmetterlinge liegt unter `schmetterlinge/`. Am Handy steht das Menü einer Region als
Leiste am unteren Rand, damit „Vogel gesehen?“ von jeder Seite aus erreichbar ist.

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

- Texte, Vogel- und Falterzeichnungen und Karte wurden mit KI (Claude) erstellt.
- Fotos stammen von Wikimedia Commons oder iNaturalist und stehen unter der jeweils
  genannten Creative-Commons-Lizenz; Urheber und Lizenz stehen im Steckbrief bei
  jedem Foto und auf der Seite „Bilder & Quellen“ jeder Region.
- Illustrationen (`illustration.svg`) stammen von Dritten und stehen unter der im
  jeweiligen Steckbrief genannten freien Lizenz; die Seite nennt Urheber und Lizenz
  bei jeder Grafik.
- Schriften: Bricolage Grotesque und Source Serif 4 unter der SIL Open Font
  License 1.1 (Lizenztexte in [`assets/fonts/`](assets/fonts/)).
