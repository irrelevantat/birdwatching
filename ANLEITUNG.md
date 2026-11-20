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
- [„Vogel gesehen?“: Arten nach Ähnlichkeit sortieren](#vogel-gesehen-arten-nach-ähnlichkeit-sortieren)
- [Texte schreiben (YAML-Tipps)](#texte-schreiben-yaml-tipps)
- [Zeichnungen (plate.svg)](#zeichnungen-platesvg)
- [Illustrationen (CC-lizenzierte SVGs)](#illustrationen-cc-lizenzierte-svgs)
- [Karten (map.svg)](#karten-mapsvg)
- [Fotos](#fotos)
- [Prüfungen und Fehlermeldungen](#prüfungen-und-fehlermeldungen)
- [Veröffentlichen](#veröffentlichen)

## So funktioniert die Seite

```
content/site.yml                    Einstellungen und Standardtexte
content/birds/<art>/bird.yml        Steckbrief einer Art
content/birds/<art>/plate.svg       Zeichnung mit nummerierten Merkmalen
content/regions/<region>/region.yml Arten, Lebensräume, Orte, Jahreszeiten, Tipps und Quellen der Region
content/regions/<region>/map.svg    Karte der Region (optional)
```

- **Eine Art = ein Ordner** unter `content/birds/`. Der Ordnername ist die *id* der
  Art (nur Kleinbuchstaben, Ziffern und Bindestriche; ä → ae, ö → oe, ü → ue,
  ß → ss). Die id erscheint auch in der Adresse, z. B. `…/ometepe/arten/fischadler/`.
- **Eine Region = ein Ordner** unter `content/regions/`. Die Startseite listet alle
  Regionen; jede Region hat mehrere Seiten (siehe unten).
- Der **Steckbrief** einer Art (Namen, Merkmale, Verhalten, Zeichnung, Foto) gilt
  überall. Was nur für eine Region gilt (Name vor Ort, Status, Lebensraum, wo man
  sie findet), steht in der `region.yml`. So kann dieselbe Art in mehreren Regionen
  vorkommen.

Seiten einer Region:

| Seite | Adresse | Inhalt |
| --- | --- | --- |
| „Vogel gesehen?“ (Hauptseite) | `…/ometepe/` | [„Vogel gesehen?“](#vogel-gesehen-arten-nach-ähnlichkeit-sortieren) und alle Arten nach Lebensraum (`birds`, `groups`); unten „Über Ometepe“ (`lead`, `facts`) |
| Steckbrief | `…/ometepe/arten/fischadler/` | `bird.yml` und der Eintrag der Art unter `birds` |
| Orte | `…/ometepe/orte/`, ein Ort: `…/ometepe/orte/#charco-verde` | `places` |
| Wann & wie | `…/ometepe/wann-und-wie/` | `season`, `tips` |
| Weitere Arten | `…/ometepe/weitere-arten/` | `more` |
| Bilder & Quellen | `…/ometepe/quellen/` | `sources`, dazu Bildnachweise |

Seiten ohne Inhalt (Orte, Wann & wie, Weitere Arten) entfallen, auch im Menü. Am
Handy steht das Menü als Leiste am unteren Rand, damit „Vogel gesehen?“ von jeder
Seite aus erreichbar ist. Alte Adressen der früheren Einzelseite (z. B.
`…/ometepe/#fischadler`) leiten auf die neuen Seiten weiter.

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
   (Werte mit Leerzeichen in Anführungszeichen). Hat die Region Lebensräume
   (`groups`), ist `--group` Pflicht. Das legt `content/birds/gruenreiher/bird.yml`
   aus der Vorlage an und ergänzt in `content/regions/ometepe/region.yml` unter
   `birds` einen Eintrag. Weitere Lebensräume dort als Liste ergänzen, z. B.
   `group: [wasser, himmel]`.

   *Ohne Skript:* Ordner `content/birds/gruenreiher/` anlegen, `vorlagen/bird.yml`
   hineinkopieren und in der `region.yml` unter `birds:` einen Eintrag ergänzen.

2. `bird.yml` ausfüllen (Pflicht sind nur `name` und `scientific`; `length` und
   `colors` braucht die Sortierung „Vogel gesehen?“). Die Beispieltexte der
   Vorlage (z. B. „Erstes Merkmal“) müssen ersetzt oder gelöscht werden; solange
   sie dastehen, meldet der Build einen Fehler.
3. In der `region.yml` beim neuen Eintrag `local`, `status` und `text` ergänzen.
4. Zeichnung als `plate.svg` in den Ordner der Art legen
   ([Zeichnungen](#zeichnungen-platesvg)). Bis dahin zeigt die Seite einen Platzhalter.
5. Optional ein Foto angeben ([Fotos](#fotos)).
6. Vorschau prüfen (`npm run dev`), dann committen.

Die Artenliste ist nach Lebensraum geordnet (Reihenfolge wie unter `groups`),
innerhalb eines Lebensraums wie unter `birds` in der `region.yml`. In dieser
Reihenfolge blättern auch „Vorige Art“ und „Nächste Art“ im Steckbrief.

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
   Neusiedler See“), Einleitung, Kennzahlen, Lebensräume, Orte, Vogeljahr,
   Tipps und Quellen in der `region.yml` ausfüllen. Nicht Benötigtes einfach
   löschen; Seiten ohne Inhalt entfallen.
3. Arten eintragen (siehe oben), mindestens eine.
4. Optional eine Karte als `map.svg` in den Ordner legen ([Karten](#karten-mapsvg)).
5. Wenn alles passt: Zeile `draft: true` löschen. Nach dem Merge auf `main` ist die
   Region online und erscheint auf der Startseite.

Die Reihenfolge auf der Startseite richtet sich nach `order` (kleinere Zahl zuerst).
Regionen ohne `order` kommen danach, alphabetisch nach Titel. Ometepe hat `order: 1`.

## Felder in bird.yml

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Deutscher Name, kurz. Steht in der Artenliste, über dem Steckbrief und in allen Links zur Art. |
| `title` | | Andere Überschrift für den Steckbrief, z. B. „Silberreiher und zwei Doppelgänger“. |
| `english` | | Englischer Name. Wird auch für die Suche bei xeno-canto verwendet. |
| `scientific` | ja | Wissenschaftlicher Name (erscheint kursiv). Mehrere Arten durch Komma trennen. |
| `length` | | Körperlänge in cm (Schnabelspitze bis Schwanzende): `23` oder `43-56`. Erscheint in der Artenliste und als erstes Kärtchen im Steckbrief („ca. 23 cm“, „43–56 cm“) und zählt bei [„Vogel gesehen?“](#vogel-gesehen-arten-nach-ähnlichkeit-sortieren). Zeigt ein Steckbrief mehrere Arten, die ganze Spanne angeben. |
| `size` | | Eigenes Größen-Kärtchen im Steckbrief, z. B. `Spannweite ca. 150–170 cm` (die Länge aus `length` bleibt davor stehen). |
| `colors` | | Auffällige Farben, z. B. `[blau, weiß, schwarz]`. Erlaubt: weiß, grau, schwarz, braun, rotbraun (auch für zimt-, rost- und kastanienfarben), rot, orange, gelb, grün, blau. Nur was man im Feld wirklich sieht. |
| `iucn` | | Gefährdung nach der Roten Liste: `LC`, `NT`, `VU`, `EN`, `CR` (auch `DD`, `EW`, `EX`). `LC` und `DD` werden nicht angezeigt, `NT` grau, ab `VU` orange. |
| `marks` | | Liste der Bestimmungsmerkmale. Reihenfolge = Nummern in der Zeichnung. |
| `behavior` | | Absatz „Verhalten“. |
| `xenocanto` | | Suchbegriff für den Link „Rufe bei xeno-canto“, falls nicht der englische Name passt. |
| `photo` | | Foto, siehe [Fotos](#fotos). |
| `photo_search` | | Ohne Foto: Suchbegriff für die Fotosuche bei Commons (Standard: wissenschaftlicher Name). |
| `illustration` | | Frei lizenzierte SVG-Grafik aus dem Repository, siehe [Illustrationen](#illustrationen-cc-lizenzierte-svgs). |
| `links` | | Weitere Links im Steckbrief: Liste mit `title` und `url`. |
| `sources` | | Zusätzliche Quellen zu dieser Art (`title`, `url`). Sie erscheinen auf der Seite „Bilder & Quellen“ jeder Region, die die Art zeigt. |

Beispiel:

```yaml
name: Fischadler
english: Osprey
scientific: Pandion haliaetus
size: Spannweite ca. 150–170 cm
length: 52-60
colors: [braun, weiß]
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

Allgemein:

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Kurzname der Region (Kopfleiste, „Über *name*“). |
| `local_heading` | | Überschrift über dem regionalen Text im Steckbrief, z. B. „Am Neusiedler See“ (Standard: „Auf *name*“). |
| `title` | ja | Seitentitel, z. B. „Vögel auf Ometepe“. |
| `eyebrow` | | Kleine Zeile über dem Titel (Land, Gewässer). |
| `summary` | | Kurzbeschreibung für die Startseite und Suchmaschinen. |
| `lead` | | Einleitung im Abschnitt „Über *name*“ unten auf der Hauptseite. |
| `updated` | | Stand der Informationen, z. B. `November 2026` (Fußzeile, Startseite). |
| `facts` | | 2–4 Kennzahlen unter „Über *name*“: Liste mit `value` und `label`. |
| `draft` | | `true` = Entwurf, nur in der Vorschau sichtbar. |
| `order` | | Reihenfolge auf der Startseite (kleinere Zahl zuerst; ohne `order` ganz hinten). |
| `footer` | | Zusatz für die Fußzeile dieser Region. |

In allen Texten der Region funktionieren die Platzhalter `{arten}` (Anzahl der
Arten) und `{orte}` (Anzahl der Orte); sie bleiben so automatisch aktuell.

Arten und Lebensräume (Hauptseite und Steckbriefe):

| Feld | Bedeutung |
| --- | --- |
| `groups` | Lebensräume: Liste mit `id` (z. B. `wald`) und `label` (z. B. „Trockenwald & Gärten“). Sie gliedern die Artenliste und sind die Angabe „Lebensraum“ in [„Vogel gesehen?“](#vogel-gesehen-arten-nach-ähnlichkeit-sortieren). Ohne `groups` entfällt beides. |
| `birds` | Liste der Arten. Pro Eintrag: |
| `birds[].id` | Ordnername der Art unter `content/birds/` (Pflicht). |
| `birds[].group` | Lebensraum: id einer Gruppe oder Liste von ids, z. B. `group: [himmel, wasser]`. Die erste bestimmt die Überschrift in der Artenliste; alle zählen bei „Vogel gesehen?“ und stehen als Kärtchen im Steckbrief. Pflicht, wenn es Gruppen gibt. |
| `birds[].local` | Name vor Ort, erscheint in der Artenliste und im Steckbrief („vor Ort: …“). |
| `birds[].status` | z. B. `ganzjährig`, `Wintergast`, `Durchzügler` (Kärtchen im Steckbrief). |
| `birds[].chips` | Weitere Kärtchen, z. B. `[Nationalvogel Nicaraguas]`. |
| `birds[].text` | Absatz unter `local_heading`: wo und wann man die Art in dieser Region findet. |
| `birds[].months` | Monate, in denen die Art in der Region ist, z. B. `9-4` für einen Wintergast (Schreibweise wie bei `season.rows[].months`). Ohne Angabe gilt: ganzjährig. Zählt bei „Vogel gesehen?“ und erscheint im Steckbrief als „Wann hier“. |

Seite „Orte“ (`places`, optional):

| Feld | Bedeutung |
| --- | --- |
| `title` | Überschrift der Seite (Standard „Karte & Orte“ bzw. „Orte“ ohne Karte; im Menü immer „Orte“). |
| `intro` | Einleitungssatz. |
| `map_label` | Beschreibung der Karte für Screenreader, z. B. „Schematische Karte der Insel Ometepe“ (der Zusatz „mit fünf Beobachtungsorten“ kommt automatisch). |
| `map_caption` | Bildunterschrift unter der Karte. |
| `sites` | Liste der Orte, nummeriert in dieser Reihenfolge: `name`, `tagline` (Untertitel), `text`, `pin: [x, y]` (Position der Nummer auf der Karte), `birds` (ids typischer Arten; nur Arten dieser Region, im Steckbrief unter „Gute Orte“), `near` (angrenzende Orte, siehe unten). Die Adresse eines Ortes ergibt sich aus dem Namen, z. B. `…/ometepe/orte/#charco-verde`; die Nummern auf der Karte führen dorthin. |
| `sites[].near` | Optional: Namen der angrenzenden Orte, z. B. `[Peña Inculta, Río Istián]`. Ohne Angabe ergeben sie sich aus der Karte: Zwei Orte grenzen aneinander, wenn kein anderer Ort zwischen ihnen liegt. `near: []` heißt: keine Nachbarn. Die Angabe gilt in beide Richtungen. |

Seite „Wann & wie“:

| Feld | Bedeutung |
| --- | --- |
| `season.title` | Überschrift (Standard „Das Vogeljahr“). |
| `season.rows` | Zeilen mit `label`, `detail` (z. B. „November bis April“) und `months`. |
| `season.rows[].months` | Bereich `11-4` (über den Jahreswechsel möglich), mehrere Bereiche `3, 6-7` oder Liste `[1, 2, 12]`. |
| `season.note` | Satz unter dem Kalender. |
| `tips.title` | Überschrift (Standard „So siehst du mehr“). |
| `tips.items` | Liste mit `title` (fett, optional) und `text`. |

Seiten „Weitere Arten“ und „Bilder & Quellen“:

| Feld | Bedeutung |
| --- | --- |
| `more.title`, `more.intro` | Überschrift (Standard „Weitere Arten“; im Menü „Mehr Arten“) und Einleitung. |
| `more.groups` | Spalten mit `title`, `note` und `species` (Liste mit `name`, optional `en`, `sci` (erscheint kursiv), `local`). |
| `sources.note` | Satz zu den Quellen. |
| `sources.list` | Liste mit `title` und `url`. Die Seite ergänzt die Quellen aus den Steckbriefen und die Bildnachweise. |

## Felder in site.yml

| Feld | Bedeutung |
| --- | --- |
| `title`, `eyebrow`, `lead` | Kopf der Startseite. `title` steht auch in der Kopfleiste jeder Seite (Link zur Startseite). |
| `regions_title` | Überschrift über den Regionen (Standard „Regionen“). |
| `description` | Beschreibung der Startseite für Suchmaschinen. |
| `footer` | Text der Fußzeile auf allen Seiten. |
| `repo_url` | Link „Quelltext auf GitHub“ in der Fußzeile (löschen = kein Link). |
| `drawings_note`, `fonts_note` | Hinweise auf der Seite „Bilder & Quellen“ jeder Region. |

## „Vogel gesehen?“: Arten nach Ähnlichkeit sortieren

Die Hauptseite jeder Region beginnt mit dem Feld **„Vogel gesehen?“** (auf großen
Bildschirmen als mitlaufende Spalte neben der Artenliste). Wer einen Vogel gesehen
hat, tippt an, was er weiß: **Farben** (mehrere möglich), **Größe** (im Vergleich zu
Kolibri, Spatz, Amsel, Taube, Krähe oder Gans), **Lebensraum**, **Ort** und
**Monat**. Alles ist freiwillig, und alle Angaben gelten zusammen.

Es wird nichts ausgeblendet, sondern sortiert: Oben stehen die Arten, die zu allen
Angaben passen („Passt gut“), darunter „Passt teilweise“ und „Passt kaum“. Jede Art
zeigt, was passt (✓), was angrenzt (≈) und was nicht passt (✗):

| Angabe | passt | zählt teilweise | Daten |
| --- | --- | --- | --- |
| Farben | Art hat die Farbe | eine ähnliche Farbe (z. B. Grün statt Blau, Grau statt Weiß) | `colors` in `bird.yml` |
| Größe | Körperlänge liegt in der Größenklasse | etwas größer oder kleiner, je näher, desto mehr | `length` in `bird.yml` |
| Lebensraum | Art gehört zum Lebensraum | – (sonst deutlich weiter hinten) | `groups` und `birds[].group` in `region.yml` |
| Ort | Art steht beim Ort unter `birds` | Art ist typisch für einen angrenzenden Ort; Arten ohne festen Ort liegen in der Mitte | `places.sites[].birds` und `near` in `region.yml` |
| Monat | Art ist in dem Monat da | der Monat direkt davor oder danach | `birds[].months` in `region.yml` (ohne Angabe ganzjährig) |

Auf der Seite „Orte“ übernimmt „Hier einen Vogel gesehen?“ bei jedem Ort den Ort
direkt in das Feld. Die Auswahl steht in der Adresse (z. B.
`…/ometepe/?farben=blau+weiss&groesse=kraehe&lebensraum=wasser`) und lässt sich so
teilen. Beim Wechsel zwischen den Seiten der Region bleibt sie erhalten.

Damit die Sortierung gut funktioniert, sollte jede Art `length` und `colors` haben,
Zugvögel `months`, Arten mehrerer Lebensräume alle passenden `group`s und die Orte
eine Liste typischer Arten. Fehlt `length` oder `colors`, meldet der Build einen
Hinweis.

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
- Erlaubt ist nur reine Vektorgrafik: Formen (`path`, `rect`, `circle`, `ellipse`,
  `line`, `polygon` …), Gruppen, Text, Verläufe, Muster, Masken, Unschärfe-Filter und
  `use`-Verweise auf ids im selben Bild. Alles andere bricht den Build mit Zeilenangabe
  ab, etwa Skripte, Event-Handler (`onclick=`), Links, Animationen, eingebettete Bilder,
  HTML-Inhalte und Verweise auf externe Dateien. Ebenso meldet er Elemente, die nicht
  geschlossen werden (z. B. ein `<g>` ohne `</g>`), und fehlende Anführungszeichen.
  Editor-Elemente von Inkscape (`sodipodi:…`, `inkscape:…`) entfernt der Build.
- Tipp: In der Vorschau (`npm run dev`) zeigt **Alt + Klick** auf eine Zeichnung
  die Koordinaten der Stelle an und kopiert sie, praktisch für Markierungen.

## Illustrationen (CC-lizenzierte SVGs)

Zusätzlich zur eigenen Zeichnung kann jede Art eine frei lizenzierte SVG-Grafik
zeigen, etwa von [Wikimedia Commons](https://commons.wikimedia.org). Anders als
Fotos liegt sie **im Repository** als `content/birds/<art>/illustration.svg`.
Im Steckbrief und in der Artenliste erscheint sie als eigene Ansicht: durch
**Wischen** über das Bild, im Steckbrief auch über die Knöpfe „Zeichnung /
Illustration / Foto“ oder per Klick auf das Bild.

1. Auf Commons eine passende SVG-Datei suchen (Lizenz CC oder gemeinfrei) und in
   der `bird.yml` eintragen:

   ```yaml
   illustration:
     file: Dateiname auf Commons.svg   # wie bei photo: mit oder ohne „File:“
     caption: Fischadler im Flug        # optional, Standard ist der Name der Art
     author: Name des Urhebers
     license: CC BY-SA 4.0
   ```

2. `npm run grafiken` lädt die Datei in voller Größe, entfernt Skripte und legt
   `illustration.svg` sowie `.illustration-source` (merkt sich die Quelle) in den
   Ordner der Art. Nur bestimmte Arten: `npm run grafiken -- fischadler`.
3. Beide Dateien committen.

Grafiken aus anderen Quellen: statt `file` die Adresse der Quelle als `url` und den
Namen der Quelle als `source` angeben und die Datei selbst als `illustration.svg`
ablegen.

Die Seite zeigt die Grafik nur mit Urheber und Lizenz an, nennt beide unter dem
Bild und auf der Seite „Bilder & Quellen“. Der Build warnt, wenn die Lizenz keine
CC-Lizenz ist, wenn die Datei fehlt oder wenn sie nicht mehr zu `file` passt.
Die Grafik wird als eigene Datei eingebunden; ihre Farben und Stile beeinflussen
die übrige Seite deshalb nicht.

## Karten (map.svg)

- Format: SVG mit `viewBox="0 0 420 340"`. Vorlage: [`vorlagen/map.svg`](vorlagen/map.svg).
- Beschriftungen mit den Klassen `t-town` (Orte), `t-peak` (Berge) und `t-sub`
  (kleine Beschriftung) bekommen automatisch die Schrift der Seite.
- **Die nummerierten Orte nicht einzeichnen.** Sie entstehen aus `pin: [x, y]` bei
  jedem Ort in der `region.yml`, in derselben Reihenfolge wie die Liste.
- Koordinaten finden: In der Vorschau **Alt + Klick** auf die Karte. Die Koordinaten
  erscheinen unten und liegen in der Zwischenablage, z. B. `[242, 170]`.
- Auf der Seite „Orte“ führen die Nummern zur Beschreibung des Ortes. Ohne
  `map.svg` stehen die Orte dort als Liste ohne Karte.

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
Ordner der Art. Liegt ein Foto vor, ist es in der Artenliste das erste Bild jeder
Karte (Wischen zeigt die Zeichnung; Urheber und Lizenz im Tooltip, im Steckbrief und
auf „Bilder & Quellen“), und im Steckbrief erscheint der Umschalter „Zeichnung /
Foto“. Besucher laden das Bild von der eigenen Website statt von Wikimedia. Ohne geladenes Foto verlinkt die Seite es nur.

Die Fotos liegen **im Repository**, damit auch die Vorschau (`npm run dev`) und
Pull Requests sie zeigen. Nach `npm run fotos` also `photo.jpg` **und**
`.photo-source` committen (der Vermerk, von welcher Commons-Datei das Foto stammt;
ohne ihn wird ein Commons-Foto nicht angezeigt). Fotos im Repository haben beim
Veröffentlichen immer Vorrang. Fehlt eines, lädt GitHub Actions es beim
Veröffentlichen nach und hebt es für die nächsten Läufe auf; drosselt Wikimedia die
Downloads, wartet das Skript die vorgegebene Zeit ab, und nicht geladene Fotos
erscheinen als Warnung in der Übersicht des Actions-Laufs.

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
Arten bei den Orten, angrenzende Orte, Monatsangaben, Längen und Farben,
Ordnernamen, nicht ersetzte Vorlagentexte, Zeichnungen (gültiges SVG, keine
aktiven Inhalte, Anzahl der Nummern), Illustrationen (Lizenz, Skripte) und Fotos
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
