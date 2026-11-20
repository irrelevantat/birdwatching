# Anleitung: Arten und Regionen pflegen

Diese Anleitung erklärt, wie du neue Vogelarten und neue Regionen hinzufügst und
welche Felder es gibt. Du brauchst dafür keinen Programmcode, nur einen Texteditor.

- [So funktioniert die Seite](#so-funktioniert-die-seite)
- [Eine neue Art hinzufügen](#eine-neue-art-hinzufügen)
- [Eine Art in eine weitere Region übernehmen](#eine-art-in-eine-weitere-region-übernehmen)
- [Eine neue Region hinzufügen](#eine-neue-region-hinzufügen)
- [Felder in bird.yml](#felder-in-birdyml)
- [Felder in region.yml](#felder-in-regionyml)
- [Felder in site.yml](#felder-in-siteyml)
- [Texte schreiben (YAML-Tipps)](#texte-schreiben-yaml-tipps)
- [Zeichnungen (plate.svg)](#zeichnungen-platesvg)
- [Karten (map.svg)](#karten-mapsvg)
- [Fotos](#fotos)
- [Prüfungen und Fehlermeldungen](#prüfungen-und-fehlermeldungen)
- [Veröffentlichen](#veröffentlichen)

## So funktioniert die Seite

```
content/site.yml                    Einstellungen und Standardtexte
content/birds/<art>/bird.yml        Steckbrief einer Art
content/birds/<art>/plate.svg       Zeichnung mit nummerierten Merkmalen
content/regions/<region>/region.yml Arten, Orte, Jahreszeiten, Tipps und Quellen der Region
content/regions/<region>/map.svg    Karte der Region (optional)
```

- **Eine Art = ein Ordner** unter `content/birds/`. Der Ordnername ist die *id* der
  Art (nur Kleinbuchstaben, Ziffern und Bindestriche; ä → ae, ö → oe, ü → ue,
  ß → ss). Die id erscheint auch in der Adresse, z. B. `…/ometepe/#fischadler`.
- **Eine Region = ein Ordner** unter `content/regions/`. Jede Region wird eine
  eigene Seite (`…/ometepe/`), die Startseite listet alle Regionen.
- Der **Steckbrief** einer Art (Namen, Merkmale, Verhalten, Zeichnung, Foto) gilt
  überall. Was nur für eine Region gilt (Name vor Ort, Status, wo man sie findet),
  steht in der `region.yml`. So kann dieselbe Art in mehreren Regionen vorkommen.

Nach jeder Änderung: `npm run dev` zeigt die Seite auf <http://localhost:8080> und
lädt bei jeder gespeicherten Änderung neu. Fehler erscheinen im Terminal und im
Browser. Ist der Port belegt: `PORT=3000 npm run dev` (Windows PowerShell:
`$env:PORT=3000; npm run dev`).

## Eine neue Art hinzufügen

1. Art anlegen und gleich in eine Region eintragen:

   ```bash
   npm run neue-art -- "Grünreiher" --region ometepe --group wasser
   ```

   Optional mit `--english "Green Heron" --scientific "Butorides virescens"`
   (Werte mit Leerzeichen in Anführungszeichen). Hat die Region Lebensraum-Gruppen,
   ist `--group` Pflicht. Das legt `content/birds/gruenreiher/bird.yml` aus der
   Vorlage an und ergänzt in `content/regions/ometepe/region.yml` unter `birds`
   einen Eintrag.

   *Ohne Skript:* Ordner `content/birds/gruenreiher/` anlegen, `vorlagen/bird.yml`
   hineinkopieren und in der `region.yml` unter `birds:` einen Eintrag ergänzen.

2. `bird.yml` ausfüllen (Pflicht sind nur `name` und `scientific`). Die
   Beispieltexte der Vorlage (z. B. „Erstes Merkmal“) müssen ersetzt oder gelöscht
   werden; solange sie dastehen, meldet der Build einen Fehler.
3. In der `region.yml` beim neuen Eintrag `local`, `status` und `text` ergänzen.
4. Zeichnung als `plate.svg` in den Ordner der Art legen
   ([Zeichnungen](#zeichnungen-platesvg)). Bis dahin zeigt die Seite einen Platzhalter.
5. Optional ein Foto angeben ([Fotos](#fotos)).
6. Vorschau prüfen (`npm run dev`), dann committen.

Die Reihenfolge der Karten auf der Seite entspricht der Reihenfolge unter `birds`
in der `region.yml`.

## Eine Art in eine weitere Region übernehmen

Gibt es die Art schon, trägt derselbe Befehl sie nur in die Region ein:

```bash
npm run neue-art -- fischadler --region neusiedler-see --group wasser
```

Danach in der `region.yml` der Region `local`, `status` und `text` anpassen.

## Eine neue Region hinzufügen

1. Region anlegen:

   ```bash
   npm run neue-region -- "Neusiedler See"
   ```

   Das erzeugt `content/regions/neusiedler-see/region.yml` aus der Vorlage mit
   `draft: true`. Entwürfe erscheinen nur in der Vorschau, nicht auf der
   veröffentlichten Website. Fehler in Entwürfen (und in Arten, die nur in
   Entwürfen vorkommen) blockieren die Veröffentlichung der anderen Regionen nicht.
2. Titel, Überschrift für die regionalen Texte (`local_heading`, z. B. „Am
   Neusiedler See“), Einleitung, Kennzahlen, Lebensraum-Gruppen, Orte, Vogeljahr,
   Tipps und Quellen in der `region.yml` ausfüllen. Nicht benötigte Abschnitte
   einfach löschen.
3. Arten eintragen (siehe oben), mindestens eine.
4. Optional eine Karte als `map.svg` in den Ordner legen ([Karten](#karten-mapsvg)).
5. Wenn alles passt: Zeile `draft: true` löschen. Nach dem Merge auf `main` ist die
   Region online und erscheint auf der Startseite.

Die Reihenfolge auf der Startseite richtet sich nach `order` (kleinere Zahl zuerst).
Regionen ohne `order` kommen danach, alphabetisch nach Titel. Ometepe hat `order: 1`.

## Felder in bird.yml

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Deutscher Name, kurz. Überschrift der Karte und Text der Links bei den Orten. |
| `title` | | Andere Überschrift für die Karte, z. B. „Silberreiher und zwei Doppelgänger“. |
| `english` | | Englischer Name. Wird auch für die Suche bei xeno-canto verwendet. |
| `scientific` | ja | Wissenschaftlicher Name (erscheint kursiv). Mehrere Arten durch Komma trennen. |
| `size` | | Größe oder Spannweite, z. B. `ca. 23 cm`. Erscheint als erstes Kärtchen. |
| `iucn` | | Gefährdung nach der Roten Liste: `LC`, `NT`, `VU`, `EN`, `CR` (auch `DD`, `EW`, `EX`). `LC` und `DD` werden nicht angezeigt, `NT` grau, ab `VU` orange. |
| `marks` | | Liste der Bestimmungsmerkmale. Reihenfolge = Nummern in der Zeichnung. |
| `behavior` | | Absatz „Verhalten“. |
| `xenocanto` | | Suchbegriff für den Link „Rufe bei xeno-canto“, falls nicht der englische Name passt. |
| `photo` | | Foto, siehe [Fotos](#fotos). |
| `photo_search` | | Ohne Foto: Suchbegriff für die Fotosuche bei Commons (Standard: wissenschaftlicher Name). |
| `links` | | Weitere Links unter der Karte: Liste mit `title` und `url`. |
| `sources` | | Zusätzliche Quellen zu dieser Art (`title`, `url`). Sie erscheinen bei jeder Region, die die Art zeigt. |

Beispiel:

```yaml
name: Fischadler
english: Osprey
scientific: Pandion haliaetus
size: Spannweite ca. 150–170 cm
marks:
  - Lange, im Handgelenk geknickte Flügel mit dunklem Bugfleck
  - Unterseite weiß
  - Dunkler Streif durchs Auge
behavior: >-
  Rüttelt über dem Wasser, stürzt mit vorgestreckten Fängen hinein und trägt den
  Fisch mit dem Kopf voran davon.
photo:
  file: Pandion haliaetus -Grover Beach, California, USA-8 (1).jpg
  caption: Fischadler mit Fisch im Flug, Kalifornien
  author: Alan Vernon
  license: CC BY 2.0
```

## Felder in region.yml

Kopf der Seite:

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Kurzname der Region. |
| `local_heading` | | Überschrift über dem regionalen Text jeder Art, z. B. „Am Neusiedler See“ (Standard: „Auf *name*“). |
| `title` | ja | Seitentitel, z. B. „Vögel auf Ometepe“. |
| `eyebrow` | | Kleine Zeile über dem Titel (Land, Gewässer). |
| `summary` | | Kurzbeschreibung für die Startseite und Suchmaschinen. |
| `lead` | | Einleitung unter dem Titel. |
| `updated` | | Stand der Informationen, z. B. `November 2026` (Fußzeile, Startseite). |
| `facts` | | 2–4 Kennzahlen: Liste mit `value` und `label`. |
| `draft` | | `true` = Entwurf, nur in der Vorschau sichtbar. |
| `order` | | Reihenfolge auf der Startseite (kleinere Zahl zuerst; ohne `order` ganz hinten). |
| `species_intro` | | Eigener Einleitungstext über den Artkarten (sonst der aus `site.yml`). |
| `footer` | | Zusatz für die Fußzeile dieser Region. |

In allen Texten der Region funktionieren die Platzhalter `{arten}` (Anzahl der
Arten) und `{orte}` (Anzahl der Orte); sie bleiben so automatisch aktuell.

Arten und Filter:

| Feld | Bedeutung |
| --- | --- |
| `groups` | Lebensraum-Filter: Liste mit `id` (z. B. `wald`) und `label` (z. B. „Trockenwald & Gärten“). Ohne Gruppen gibt es keinen Filter. Die Zahlen auf den Knöpfen zählt die Seite selbst. |
| `birds` | Liste der Arten in Anzeigereihenfolge. Pro Eintrag: |
| `birds[].id` | Ordnername der Art unter `content/birds/` (Pflicht). |
| `birds[].group` | id einer Gruppe (Pflicht, wenn es Gruppen gibt). |
| `birds[].local` | Name vor Ort, erscheint als „vor Ort: …“. |
| `birds[].status` | z. B. `ganzjährig`, `Wintergast`, `Durchzügler` (Kärtchen). |
| `birds[].chips` | Weitere Kärtchen, z. B. `[Nationalvogel Nicaraguas]`. |
| `birds[].text` | Absatz unter `local_heading`: wo und wann man die Art in dieser Region findet. |

Karte & Orte (`places`, optional):

| Feld | Bedeutung |
| --- | --- |
| `title` | Abschnittstitel (Standard „Karte & Orte“ bzw. „Orte“ ohne Karte). |
| `intro` | Einleitungssatz. |
| `map_label` | Beschreibung der Karte für Screenreader, z. B. „Schematische Karte der Insel Ometepe“ (der Zusatz „mit fünf Beobachtungsorten“ kommt automatisch). |
| `map_caption` | Bildunterschrift unter der Karte. |
| `sites` | Liste der Orte, nummeriert in dieser Reihenfolge: `name`, `tagline` (Untertitel), `text`, `pin: [x, y]` (Position der Nummer auf der Karte), `birds` (ids typischer Arten; nur Arten dieser Region). |

Wann & wie:

| Feld | Bedeutung |
| --- | --- |
| `season.title` | Überschrift (Standard „Das Vogeljahr“). |
| `season.rows` | Zeilen mit `label`, `detail` (z. B. „November bis April“) und `months`. |
| `season.rows[].months` | Bereich `11-4` (über den Jahreswechsel möglich), mehrere Bereiche `3, 6-7` oder Liste `[1, 2, 12]`. |
| `season.note` | Satz unter dem Kalender. |
| `tips.title` | Überschrift (Standard „So siehst du mehr“). |
| `tips.items` | Liste mit `title` (fett, optional) und `text`. |

Weitere Arten und Quellen:

| Feld | Bedeutung |
| --- | --- |
| `more.title`, `more.intro` | Titel (Standard „Weitere Arten“) und Einleitung. |
| `more.groups` | Spalten mit `title`, `note` und `species` (Liste mit `name`, optional `en`, `sci` (erscheint kursiv), `local`). |
| `sources.note` | Satz zu den Quellen. |
| `sources.list` | Liste mit `title` und `url`. |

Abschnitte ohne Inhalt lässt die Seite weg, auch im Menü.

## Felder in site.yml

| Feld | Bedeutung |
| --- | --- |
| `title`, `eyebrow`, `lead` | Kopf der Startseite. `title` erscheint auch im Zurück-Link jeder Region. |
| `regions_title` | Überschrift über den Regionen (Standard „Regionen“). |
| `description` | Beschreibung der Startseite für Suchmaschinen. |
| `footer` | Text der Fußzeile auf allen Seiten. |
| `repo_url` | Link „Quelltext auf GitHub“ in der Fußzeile (löschen = kein Link). |
| `species_intro` | Einleitung über den Artkarten jeder Region. |
| `photo_hint_linked`, `photo_hint_shown` | Satz zu den Fotos, je nachdem ob Fotos nur verlinkt oder direkt angezeigt werden. |
| `drawings_note`, `fonts_note` | Hinweise im Abschnitt „Bilder & Quellen“. |

## Texte schreiben (YAML-Tipps)

- Eingerückt wird **nur mit Leerzeichen** (zwei pro Ebene), nie mit Tabulatoren.
- Lange Texte als Block schreiben. Zeilenumbrüche innerhalb des Blocks werden zu
  Leerzeichen, die Einrückung muss gleich bleiben:

  ```yaml
  text: >-
    Erste Zeile des Absatzes,
    die hier einfach weitergeht.
  ```

- Ein Text mit `: ` (Doppelpunkt und Leerzeichen) oder einem `#` nach einem
  Leerzeichen muss als Block (`>-`) oder in Anführungszeichen stehen:
  `tagline: "Lagune: Trockenwald und Strand"`. Dasselbe gilt für Texte, die mit
  `*`, `[`, `"`, `'`, `&`, `!`, `%`, `@`, `|` oder `>` beginnen, etwa
  `text: "*Ara macao* lebt hier."`.
- Werte werden genau so übernommen, wie sie dastehen: `value: 2.500` bleibt „2.500“,
  `status: 1.0` bleibt „1.0“. Anführungszeichen sind dafür nicht nötig.
- Ein ` #` (Leerzeichen und Raute) beginnt einen Kommentar. Soll es zum Text gehören,
  den Text in Anführungszeichen setzen: `size: "Platz #1"`. Der Build weist darauf hin.
- Adressen (`url`, `license_url`, `repo_url`) müssen mit `https://` beginnen.
- Formatierung in Texten: `*kursiv*`, `**fett**`, `[Linktext](https://…)`.
  HTML ist nicht erlaubt und wird als Text angezeigt.

## Zeichnungen (plate.svg)

Die Zeichnungen sind Schemata, die die Bestimmungsmerkmale betonen.

- Format: SVG mit `viewBox="0 0 320 240"`. Vorlage: [`vorlagen/plate.svg`](vorlagen/plate.svg).
  Ein Blick in eine vorhandene Zeichnung (z. B. `content/birds/fischadler/plate.svg`)
  zeigt, wie Umriss, Farbflächen und Markierungen aufgebaut sind.
- Hintergrund: eine Fläche über das ganze Bild, z. B. `#efe6d2` (Wald, Gärten) oder
  `#e6ecd8`.
- **Nummern:** Jede Nummer ist eine Gruppe `<g class="mk">…</g>` aus Linie, Punkt am
  Vogel und Nummernkreis. Die Nummern gehören in derselben Reihenfolge zu `marks`
  in der `bird.yml`. Stimmt die Anzahl nicht überein, meldet der Build einen Hinweis.
- Farben direkt als Attribute (`fill="#5b8fc7"`) angeben, **kein `<style>`-Block**
  (er würde auf der ganzen Seite wirken). Aus Inkscape als „Optimiertes SVG“ oder
  „Normales SVG“ speichern; Editor-Metadaten entfernt der Build.
- ids (etwa für `clipPath`) darfst du frei wählen; der Build macht sie eindeutig.
- `aria-label="Schematische Zeichnung: …"` beschreibt das Bild für Screenreader.
  Fehlt es, setzt der Build „Schematische Zeichnung: *Name*“ ein.
- Nicht erlaubt (der Build bricht mit Zeilenangabe ab): `<script>`, Event-Handler wie
  `onclick=`, Links mit `javascript:`/`data:` und `<foreignObject>`. Ebenso meldet er
  Elemente, die nicht geschlossen werden (z. B. ein `<g>` ohne `</g>`).
- Tipp: In der Vorschau (`npm run dev`) zeigt **Alt + Klick** auf eine Zeichnung
  die Koordinaten der Stelle an und kopiert sie, praktisch für Markierungen.

## Karten (map.svg)

- Format: SVG mit `viewBox="0 0 420 340"`. Vorlage: [`vorlagen/map.svg`](vorlagen/map.svg).
- Beschriftungen mit den Klassen `t-town` (Orte), `t-peak` (Berge) und `t-sub`
  (kleine Beschriftung) bekommen automatisch die Schrift der Seite.
- **Die nummerierten Orte nicht einzeichnen.** Sie entstehen aus `pin: [x, y]` bei
  jedem Ort in der `region.yml`, in derselben Reihenfolge wie die Liste.
- Koordinaten finden: In der Vorschau **Alt + Klick** auf die Karte. Die Koordinaten
  erscheinen unten und liegen in der Zwischenablage, z. B. `[242, 170]`.
- Ohne `map.svg` zeigt die Seite die Orte als Liste ohne Karte.

## Fotos

Fotos kommen von [Wikimedia Commons](https://commons.wikimedia.org) und stehen unter
freien Lizenzen. Urheber und Lizenz müssen immer genannt werden; die Seite macht das
automatisch aus den Angaben in der `bird.yml`.

```yaml
photo:
  file: Great Egret (Ardea alba) RWD.jpg   # Dateiname auf Commons (mit oder ohne „File:“)
  caption: Silberreiher in North Carolina, USA
  author: Dick Daniels
  license: CC BY-SA 3.0
```

- `file`: der Dateiname von der Commons-Seite. Auch die ganze Adresse
  (`https://commons.wikimedia.org/wiki/File:…`) funktioniert.
- `license`: wie auf Commons angegeben, z. B. `CC BY 4.0`, `CC BY-SA 2.0`, `CC0`.
  Der Link zur Lizenz entsteht automatisch. Bei anderen Lizenzen `license_url` angeben.
- `caption` (Bildunterschrift) ist optional, Standard ist der Name der Art.

**Anzeige:** `npm run fotos` lädt die Fotos (960 px breit) als `photo.jpg` in den
Ordner der Art. Liegt ein Foto vor, erscheint auf der Karte der Umschalter
„Zeichnung / Foto“, und Besucher laden das Bild von der eigenen Website statt von
Wikimedia. Ohne geladenes Foto verlinkt die Seite es nur. Beim Veröffentlichen lädt
GitHub Actions die Fotos automatisch und hebt sie für die nächsten Läufe auf, du musst
sie also nicht committen. Drosselt Wikimedia die Downloads, wartet das Skript die
vorgegebene Zeit ab; nicht geladene Fotos erscheinen als Warnung in der Übersicht des
Actions-Laufs. Pull Requests werden ohne Fotos gebaut. Wer sie fest
im Repository haben möchte, führt `npm run fotos` lokal aus und committet `photo.jpg`
und `.photo-source`.

`npm run fotos` vergleicht außerdem Lizenz und Urheber mit den Angaben auf Commons
und meldet Abweichungen. Ändert sich `file`, lädt es das Foto neu; bis dahin zeigt die
Seite das alte Foto nicht mehr an.

Fotos aus anderen Quellen: statt `file` die Adresse der Fotoseite als `url` und die
Quelle als `source` angeben (z. B. `source: Flickr`) und das Bild selbst als
`photo.jpg` (oder `.png`, `.webp`) in den Ordner der Art legen.

## Prüfungen und Fehlermeldungen

`npm run build` (und damit auch `npm run dev` und GitHub Actions) prüft alle Inhalte,
bevor eine Seite entsteht. **Fehler** verhindern die Veröffentlichung, **Hinweise**
nicht. Jede Meldung nennt Datei und Stelle, zum Beispiel:

```
content/regions/ometepe/region.yml
  ✖ Fehler  Zeile 101 · birds[6].id: Art „zimtamazilei“ gibt es nicht unter content/birds/. Meintest du „zimtamazilie“?
  ✖ Fehler  Zeile 122 · birds[9].group: Art „nacktkehlreiher“: Gruppe „wassr“ ist oben unter groups nicht definiert. Meintest du „wasser“?
content/birds/fischadler/bird.yml
  ✖ Fehler  Zeile 11 · behaviour: Unbekanntes Feld „behaviour“. Meintest du „behavior“?
content/birds/gruenreiher
  ⚠ Hinweis Noch keine Zeichnung (plate.svg); es wird ein Platzhalter angezeigt
```

„Zeile 101“ ist die Zeile in der genannten Datei. `birds[6]` heißt: der Eintrag
Nummer 6 in der Liste `birds`, gezählt ab 0 (also der siebte).

Geprüft werden unter anderem: YAML-Syntax, Tippfehler in Feldnamen, Pflichtfelder,
Texte mit `: ` ohne Anführungszeichen, Adressen, Verweise auf Arten und Gruppen,
Arten bei den Orten, Monatsangaben, Ordnernamen, nicht ersetzte Vorlagentexte,
Zeichnungen (gültiges SVG, keine aktiven Inhalte, Anzahl der Nummern) und Fotos
(Lizenzangaben, veraltete Dateien). Hinweise (z. B. eine Art ohne Zeichnung)
verhindern die Veröffentlichung nicht.

## Veröffentlichen

1. Änderungen auf einem Branch committen und einen Pull Request öffnen.
   GitHub Actions prüft und baut die Seite; Fehler erscheinen dort im Log.
2. Nach dem Merge auf `main` veröffentlicht der Workflow die Seite auf GitHub Pages.

Einmalig nötig: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
Wurde vorher schon gemergt, scheitert der erste Lauf mit „Get Pages site failed“;
dann unter **Actions → Website → Run workflow** neu starten.

### Ohne Git: direkt im Browser bearbeiten

Kleine Änderungen gehen auch auf github.com: Datei öffnen, auf den Stift
(„Edit this file“) klicken, ändern, unten „Commit changes…“ wählen, **„Create a new
branch … and start a pull request“** auswählen und bestätigen. GitHub Actions prüft
die Änderung im Pull Request; ist alles grün, kann er gemergt werden. Neue Ordner
legst du mit „Add file → Create new file“ an, indem du den Pfad mit `/` eintippst,
z. B. `content/birds/gruenreiher/bird.yml`.

### Schriften

Die Schriften liegen als Teilmengen (Grundzeichen, Umlaute, westeuropäische Akzente)
unter `assets/fonts/`. Zeichen außerhalb dieser Teilmenge (etwa ő, ł, č oder €) zeigt
der Browser in einer Ersatzschrift an. Für solche Regionen die vollständigen Schriftdateien von
Google Fonts unter denselben Dateinamen ablegen.
