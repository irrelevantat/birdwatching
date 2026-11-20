# Anleitung: Arten und Regionen pflegen

Diese Anleitung erklärt, wie du neue Arten (Vögel, Schmetterlinge) und neue Regionen
hinzufügst und welche Felder es gibt. Du brauchst dafür keinen Programmcode, nur einen
Texteditor.

- [So funktioniert die Seite](#so-funktioniert-die-seite)
- [Tiergruppen: Vögel und Schmetterlinge](#tiergruppen-vögel-und-schmetterlinge)
- [Eine neue Art hinzufügen](#eine-neue-art-hinzufügen)
- [Eine Art in eine weitere Region übernehmen](#eine-art-in-eine-weitere-region-übernehmen)
- [Eine neue Region hinzufügen](#eine-neue-region-hinzufügen)
- [Felder in bird.yml](#felder-in-birdyml)
- [Felder in butterfly.yml](#felder-in-butterflyyml)
- [Felder in region.yml und butterflies.yml](#felder-in-regionyml-und-butterfliesyml)
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
content/site.yml                          Einstellungen und Standardtexte
content/birds/<art>/bird.yml              Steckbrief eines Vogels
content/birds/<art>/plate.svg             Zeichnung mit nummerierten Merkmalen
content/butterflies/<art>/butterfly.yml   Steckbrief eines Schmetterlings
content/butterflies/<art>/plate.svg       Zeichnung mit nummerierten Merkmalen
content/regions/<region>/region.yml       Vögel der Region: Arten, Orte, Jahreszeiten, Tipps, Quellen
content/regions/<region>/butterflies.yml  Schmetterlinge der Region (gleiche Felder)
content/regions/<region>/map.svg          Karte der Region (optional, für alle Tiergruppen)
```

- **Eine Art = ein Ordner** unter `content/birds/` (Vögel) oder
  `content/butterflies/` (Schmetterlinge). Der Ordnername ist die *id* der Art (nur
  Kleinbuchstaben, Ziffern und Bindestriche; ä → ae, ö → oe, ü → ue, ß → ss). Die id
  erscheint auch in der Adresse, z. B. `…/ometepe/#fischadler`.
- **Eine Region = ein Ordner** unter `content/regions/`. Darin steht je Tiergruppe
  eine Datei: `region.yml` für die Vögel, `butterflies.yml` für die Schmetterlinge.
  Jede Datei wird eine eigene Seite (`…/ometepe/` und `…/schmetterlinge/ometepe/`).
- Der **Steckbrief** einer Art (Namen, Merkmale, Verhalten, Zeichnung, Foto) gilt
  überall. Was nur für eine Region gilt (Name vor Ort, Status, wo man sie findet),
  steht in der Regionsdatei. So kann dieselbe Art in mehreren Regionen vorkommen.

Nach jeder Änderung: `npm run dev` zeigt die Seite auf <http://localhost:8080> und
lädt bei jeder gespeicherten Änderung neu. Fehler erscheinen im Terminal und im
Browser. Ist der Port belegt: `PORT=3000 npm run dev` (Windows PowerShell:
`$env:PORT=3000; npm run dev`).

## Tiergruppen: Vögel und Schmetterlinge

Oben auf jeder Seite wählt man die Tiergruppe: **Vögel** oder **Schmetterlinge**.
Jede Tiergruppe hat eine eigene Übersicht (Vögel auf der Startseite, Schmetterlinge
unter `…/schmetterlinge/`) und eigene Regionsseiten. **Gemischt wird nicht:** Eine
Seite zeigt nur Arten ihrer Tiergruppe, und eine Regionsdatei darf nur Arten aus dem
passenden Ordner verwenden (`region.yml` → `content/birds/`, `butterflies.yml` →
`content/butterflies/`). Sonst meldet der Build einen Fehler.

Auf einer Regionsseite führt der Wechsel zur selben Region der anderen Tiergruppe,
z. B. von „Vögel auf Ometepe“ zu „Schmetterlinge auf Ometepe“. Gibt es die Region dort
nicht, führt er zur Übersicht der Tiergruppe. Die Zahl neben jeder Tiergruppe ist die
Anzahl ihrer Arten (in dieser Region bzw. insgesamt). Gibt es nur eine Tiergruppe mit
Regionen, entfällt die Auswahl.

| | Vögel | Schmetterlinge |
| --- | --- | --- |
| Steckbriefe | `content/birds/<art>/bird.yml` | `content/butterflies/<art>/butterfly.yml` |
| Regionsdatei | `content/regions/<region>/region.yml` | `content/regions/<region>/butterflies.yml` |
| Artenliste in der Regionsdatei und bei den Orten | `birds` | `butterflies` |
| Größe | `length` (Körperlänge) | `wingspan` (Spannweite) |
| Adresse | `…/ometepe/` | `…/schmetterlinge/ometepe/` |
| Befehle | ohne Zusatz | mit `--type schmetterlinge` |

Ein Regionsordner darf deshalb nicht `schmetterlinge` heißen. Eine **neue
Tiergruppe** (etwa Libellen) braucht Programmcode an zwei Stellen: einen Eintrag in
`scripts/lib/kinds.mjs` (Ordner, Dateinamen, Größenklassen, Wörter auf der Seite,
Beispiele für die Skripte) und ihren Fotoordner (`content/<ordner>/*/photo.*` und
`.photo-source`) im Zwischenspeicher und Abgleich von
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). Dazu kommen Vorlagen in
`vorlagen/`.

## Eine neue Art hinzufügen

1. Art anlegen und gleich in eine Region eintragen:

   ```bash
   npm run neue-art -- "Kahnschnabel" --region ometepe --group wasser
   ```

   Optional mit `--english "Boat-billed Heron" --scientific "Cochlearius cochlearius"`
   (Werte mit Leerzeichen in Anführungszeichen). Hat die Region Lebensraum-Gruppen,
   ist `--group` Pflicht. Das legt `content/birds/kahnschnabel/bird.yml` aus der
   Vorlage an und ergänzt in `content/regions/ometepe/region.yml` unter `birds`
   einen Eintrag.

   *Ohne Skript:* Ordner `content/birds/kahnschnabel/` anlegen, `vorlagen/bird.yml`
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

Die Reihenfolge der Karten auf der Seite entspricht der Reihenfolge unter `birds`
in der `region.yml`.

**Schmetterlinge** genauso, mit `--type schmetterlinge`:

```bash
npm run neue-art -- "Heliconius hecale" --type schmetterlinge --region ometepe --group garten-waldrand
```

Das legt `content/butterflies/heliconius-hecale/butterfly.yml` an (Vorlage
`vorlagen/butterfly.yml`) und trägt die Art in `content/regions/ometepe/butterflies.yml`
unter `butterflies` ein. Die Schmetterlinge tragen als Ordnernamen den
wissenschaftlichen Namen (`dryas-iulia`), weil viele keinen deutschen Namen haben;
gibt es einen deutschen Namen, steht er in `name` (bei `dryas-iulia`: Julia-Falter).
Vorher in `content/butterflies/` nachsehen, ob es die Art schon gibt: Der Build
erkennt doppelte Arten nur am Ordnernamen.

## Eine Art in eine weitere Region übernehmen

Gibt es die Art schon, trägt derselbe Befehl sie nur in die Region ein:

```bash
npm run neue-art -- fischadler --region neusiedler-see --group wasser
```

Danach in der `region.yml` der Region `local`, `status` und `text` anpassen. Für
Schmetterlinge wieder mit `--type schmetterlinge` (Eintrag in `butterflies.yml`).

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

**Schmetterlinge einer Region:** `npm run neue-region -- ometepe --type schmetterlinge`
legt `butterflies.yml` (Vorlage `vorlagen/butterflies.yml`) im Ordner der Region an,
auch wenn es dort schon eine `region.yml` gibt; der Name der Region wird übernommen.
Die Datei hat dieselben Felder wie die `region.yml`, nur heißt die Artenliste
`butterflies`. Eine vorhandene `map.svg` gilt für beide Tiergruppen; die Orte und ihre
Positionen (`pin`) stehen in jeder Datei für sich. Eine Region kann auch nur
Schmetterlinge haben (nur `butterflies.yml` im Ordner).

## Felder in bird.yml

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Deutscher Name, kurz. Überschrift der Karte und Text der Links bei den Orten. |
| `title` | | Andere Überschrift für die Karte, z. B. „Silberreiher und zwei Doppelgänger“. |
| `english` | | Englischer Name. Wird auch für die Suche bei xeno-canto verwendet. |
| `scientific` | ja | Wissenschaftlicher Name (erscheint kursiv). Mehrere Arten durch Komma trennen. |
| `length` | | Körperlänge in cm (Schnabelspitze bis Schwanzende): `23` oder `43-56`. Erscheint als erstes Kärtchen („ca. 23 cm“, „43–56 cm“) und zählt bei [„Vogel gesehen?“](#vogel-gesehen-arten-nach-ähnlichkeit-sortieren). Zeigt eine Karte mehrere Arten, die ganze Spanne angeben. |
| `size` | | Anderer Text für das Größen-Kärtchen statt der Länge, z. B. `Spannweite ca. 150–170 cm`. |
| `colors` | | Auffällige Farben, z. B. `[blau, weiß, schwarz]`. Erlaubt: weiß, grau, schwarz, braun, rotbraun (auch für zimt-, rost- und kastanienfarben), rot, orange, gelb, grün, blau. Nur was man im Feld wirklich sieht. |
| `iucn` | | Gefährdung nach der Roten Liste: `LC`, `NT`, `VU`, `EN`, `CR` (auch `DD`, `EW`, `EX`). `LC` und `DD` werden nicht angezeigt, `NT` grau, ab `VU` orange. |
| `marks` | | Liste der Bestimmungsmerkmale. Reihenfolge = Nummern in der Zeichnung. |
| `behavior` | | Absatz „Verhalten“. |
| `lookalikes` | | Absatz „Verwechslung“: ähnliche Arten und woran man sie unterscheidet. |
| `xenocanto` | | Suchbegriff für den Link „Rufe bei xeno-canto“, falls nicht der englische Name passt. |
| `photo` | | Foto, siehe [Fotos](#fotos). |
| `photo_search` | | Ohne Foto: Suchbegriff für die Fotosuche bei Commons (Standard: wissenschaftlicher Name). |
| `illustration` | | Frei lizenzierte SVG-Grafik aus dem Repository, siehe [Illustrationen](#illustrationen-cc-lizenzierte-svgs). |
| `links` | | Weitere Links unter der Karte: Liste mit `title` und `url`. |
| `sources` | | Zusätzliche Quellen zu dieser Art (`title`, `url`). Sie erscheinen bei jeder Region, die die Art zeigt. |

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

## Felder in butterfly.yml

Wie in der `bird.yml` (`name`, `title`, `english`, `scientific`, `size`, `colors`,
`iucn`, `marks`, `behavior`, `photo`, `photo_search`, `illustration`, `links`,
`sources`), dazu:

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Deutscher Name. Viele tropische Falter haben keinen; dann den wissenschaftlichen Namen eintragen. Er erscheint dann kursiv und unter der Überschrift nicht noch einmal. |
| `wingspan` | | Spannweite in cm: `8` oder `7,1-10,2`. Erscheint als Kärtchen („Spannweite 7,1–10,2 cm“) und zählt bei „Schmetterling gesehen?“. Sind die Quellen uneins, die ganze Spanne angeben und mit `size` erklären, z. B. `size: "Spannweite 6,3–20,3 cm (Quellen uneins)"`. |
| `colors` | | Auffällige Farben von Ober- und Unterseite, gleiche Farbliste wie bei Vögeln. |
| `foodplants` | | Absatz „Raupenfutter“. |
| `lookalikes` | | Absatz „Verwechslung“: ähnliche Arten und woran man sie unterscheidet (gibt es auch in der `bird.yml`). |

Statt „Rufe bei xeno-canto“ steht unter jeder Karte ein Link „Art bei iNaturalist“.

## Felder in region.yml und butterflies.yml

Beide Dateien haben dieselben Felder. In der `butterflies.yml` heißt die Artenliste
`butterflies` statt `birds`, ebenso bei den Orten (`places.sites[].butterflies`).

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
| `birds[].months` | Monate, in denen die Art in der Region ist, z. B. `9-4` für einen Wintergast (Schreibweise wie bei `season.rows[].months`). Ohne Angabe gilt: ganzjährig. Zählt bei „Vogel gesehen?“. |

Karte & Orte (`places`, optional):

| Feld | Bedeutung |
| --- | --- |
| `title` | Abschnittstitel (Standard „Karte & Orte“ bzw. „Orte“ ohne Karte). |
| `intro` | Einleitungssatz. |
| `map_label` | Beschreibung der Karte für Screenreader, z. B. „Schematische Karte der Insel Ometepe“ (der Zusatz „mit fünf Beobachtungsorten“ kommt automatisch). |
| `map_caption` | Bildunterschrift unter der Karte. |
| `sites` | Liste der Orte, nummeriert in dieser Reihenfolge: `name`, `tagline` (Untertitel), `text`, `pin: [x, y]` (Position der Nummer auf der Karte), `birds` (ids typischer Arten; nur Arten dieser Region), `near` (angrenzende Orte, siehe unten). |
| `sites[].near` | Optional: Namen der angrenzenden Orte, z. B. `[Peña Inculta, Río Istián]`. Ohne Angabe ergeben sie sich aus der Karte: Zwei Orte grenzen aneinander, wenn kein anderer Ort zwischen ihnen liegt. `near: []` heißt: keine Nachbarn. Die Angabe gilt in beide Richtungen. |

Wann & wie:

| Feld | Bedeutung |
| --- | --- |
| `season.title` | Überschrift (Standard „Das Vogeljahr“ bzw. „Das Falterjahr“). |
| `season.rows` | Zeilen mit `label`, `detail` (z. B. „November bis April“) und `months`. |
| `season.rows[].months` | Bereich `11-4` (über den Jahreswechsel möglich), mehrere Bereiche `3, 6-7` oder Liste `[1, 2, 12]`. |
| `season.note` | Satz unter dem Kalender. |
| `tips.title` | Überschrift (Standard „So siehst du mehr“). |
| `tips.items` | Liste mit `title` (fett, optional) und `text`. |

Weitere Arten und Quellen:

| Feld | Bedeutung |
| --- | --- |
| `more.title`, `more.intro` | Titel (Standard „Weitere Arten“) und Einleitung. |
| `more.groups` | Spalten mit `title`, `note` und `species` (Liste mit `name`, optional `en`, `sci` (erscheint kursiv), `local`). Statt `name` genügt `sci`, dann ist der wissenschaftliche Name die Überschrift des Eintrags. Lange Listen (ab 15 Namen) laufen in Spalten über die ganze Breite. |
| `sources.note` | Satz zu den Quellen. |
| `sources.list` | Liste mit `title` und `url`. |
| `sources.caveats` | Optional: Liste von Angaben, die nicht durch die Quellen belegt sind. Erscheint unter „Was nicht belegt ist“. |

Abschnitte ohne Inhalt lässt die Seite weg, auch im Menü.

## Felder in site.yml

| Feld | Bedeutung |
| --- | --- |
| `title` | Name der ganzen Website (Fehlerseite). |
| `footer` | Text der Fußzeile auf allen Seiten. |
| `repo_url` | Link „Quelltext auf GitHub“ in der Fußzeile (löschen = kein Link). |
| `species_intro` | Einleitung über den Artkarten jeder Region. |
| `photo_hint_linked`, `photo_hint_shown` | Satz zu den Fotos, je nachdem ob Fotos nur verlinkt oder direkt angezeigt werden. |
| `fonts_note` | Hinweis zu den Schriften im Abschnitt „Bilder & Quellen“. |
| `animals` | Texte je Tiergruppe, unter `voegel:` und `schmetterlinge:` (siehe unten). |

Felder unter `animals.voegel` und `animals.schmetterlinge` (alle optional):

| Feld | Bedeutung |
| --- | --- |
| `title`, `eyebrow`, `lead` | Kopf der Übersichtsseite der Tiergruppe. `title` (Standard „Vogelführer“ bzw. „Schmetterlingsführer“) erscheint auch im Zurück-Link jeder Region. |
| `label` | Name in der Auswahl oben (Standard „Vögel“ bzw. „Schmetterlinge“). |
| `regions_title` | Überschrift über den Regionen (Standard „Regionen“). |
| `description` | Beschreibung der Übersichtsseite für Suchmaschinen. |
| `species_intro` | Eigene Einleitung über den Artkarten dieser Tiergruppe. |
| `drawings_note` | Hinweis zu den Zeichnungen im Abschnitt „Bilder & Quellen“. |

Fehlt ein Feld unter `animals`, gilt das gleichnamige Feld oben in der `site.yml`
(etwa `species_intro`). Ausnahmen sind `title` und `label`: Ohne Angabe gelten die
Standards „Vogelführer“/„Schmetterlingsführer“ und „Vögel“/„Schmetterlinge“, denn
`title` oben ist der Name der ganzen Website.

## „Vogel gesehen?“: Arten nach Ähnlichkeit sortieren

Über den Artkarten jeder Region steht unter dem Lebensraum-Filter das Feld
**„Vogel gesehen?“**. Wer einen Vogel gesehen hat, gibt an, was er weiß: **Monat**,
**Größe** (im Vergleich zu Kolibri, Spatz, Amsel, Taube, Krähe oder Gans), **Ort**
und **Farben**. Alles ist freiwillig, und alle Angaben gelten zusammen.

Es wird nichts ausgeblendet, sondern sortiert: Oben stehen die Arten, die zu allen
Angaben passen, darunter „Passt teilweise“ und „Passt kaum“. Jede Karte zeigt, was
passt (✓), was angrenzt (≈) und was nicht passt (✗). Teilweise zählen:

| Angabe | passt | zählt teilweise | Daten |
| --- | --- | --- | --- |
| Monat | Art ist in dem Monat da | der Monat direkt davor oder danach | `birds[].months` in `region.yml` (ohne Angabe ganzjährig) |
| Größe | Körperlänge liegt in der Größenklasse | etwas größer oder kleiner, je näher, desto mehr | `length` in `bird.yml` |
| Ort | Art steht beim Ort unter `birds` | Art ist typisch für einen angrenzenden Ort; Arten ohne festen Ort liegen in der Mitte | `places.sites[].birds` und `near` in `region.yml` |
| Farben | Art hat die Farbe | eine ähnliche Farbe (z. B. Grün statt Blau, Grau statt Weiß) | `colors` in `bird.yml` |

Der Lebensraum-Filter funktioniert wie bisher und lässt sich mit der Sortierung
kombinieren: Er blendet die anderen Lebensräume aus, „Vogel gesehen?“ sortiert die
übrigen Arten. Bei jedem Ort unter „Karte & Orte“ übernimmt „Hier einen Vogel
gesehen?“ den Ort direkt in das Feld. Die Auswahl steht in der Adresse der Seite
(z. B. `…/ometepe/?monat=7&groesse=kraehe&farben=blau+weiss`) und lässt sich so
teilen.

Damit die Sortierung gut funktioniert, sollte jede Art `length` und `colors` haben,
Zugvögel `months`, und die Orte eine Liste typischer Arten. Fehlt `length` oder
`colors`, meldet der Build einen Hinweis.

Auf den Seiten der Schmetterlinge heißt das Feld **„Schmetterling gesehen?“**. Statt
der Körperlänge zählt die Spannweite (`wingspan`), verglichen mit Bläuling (bis
4 cm), Kohlweißling (4–6 cm), Schwalbenschwanz (6–8 cm), Handteller (8–11 cm) und
„Riesig“ (über 11 cm). Bei den Orten stehen die Arten, die dort gemeldet wurden
(`places.sites[].butterflies`). `months` nur angeben, wenn eine Art sicher nicht
ganzjährig fliegt: Fehlende Fundmonate heißen meist nur, dass dann niemand
fotografiert hat.

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
  Ein Blick in eine vorhandene Zeichnung (z. B. `content/birds/fischadler/plate.svg`
  oder `content/butterflies/caligo-telamonius/plate.svg` mit Ober- und Unterseite)
  zeigt, wie Umriss, Farbflächen und Markierungen aufgebaut sind.
- Hintergrund: eine Fläche über das ganze Bild, z. B. `#efe6d2` (Wald, Gärten) oder
  `#e6ecd8`.
- **Nummern:** Jede Nummer ist eine Gruppe `<g class="mk">…</g>` aus Linie, Punkt am
  Tier und Nummernkreis. Die Nummern gehören in derselben Reihenfolge zu `marks`
  im Steckbrief. Stimmt die Anzahl nicht überein, meldet der Build einen Hinweis.
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
Auf der Karte erscheint sie als eigene Ansicht: über die Knöpfe „Zeichnung /
Illustration / Foto“ oder per **Klick auf das Bild**, der zur nächsten Ansicht
weiterschaltet.

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
Bild und im Abschnitt „Bilder & Quellen“. Der Build warnt, wenn die Lizenz keine
CC-Lizenz ist, wenn die Datei fehlt oder wenn sie nicht mehr zu `file` passt.
Die Grafik wird als eigene Datei eingebunden; ihre Farben und Stile beeinflussen
die übrige Seite deshalb nicht.

## Karten (map.svg)

- Format: SVG mit `viewBox="0 0 420 340"`. Vorlage: [`vorlagen/map.svg`](vorlagen/map.svg).
- Beschriftungen mit den Klassen `t-town` (Orte), `t-peak` (Berge) und `t-sub`
  (kleine Beschriftung) bekommen automatisch die Schrift der Seite.
- **Die nummerierten Orte nicht einzeichnen.** Sie entstehen aus `pin: [x, y]` bei
  jedem Ort in der Regionsdatei, in derselben Reihenfolge wie die Liste. Dieselbe
  Karte kann so für Vögel und Schmetterlinge verschiedene Orte zeigen.
- Koordinaten finden: In der Vorschau **Alt + Klick** auf die Karte. Die Koordinaten
  erscheinen unten und liegen in der Zwischenablage, z. B. `[242, 170]`.
- Ohne `map.svg` zeigt die Seite die Orte als Liste ohne Karte.

## Fotos

Fotos kommen von [Wikimedia Commons](https://commons.wikimedia.org) und stehen unter
freien Lizenzen. Urheber und Lizenz müssen immer genannt werden; die Seite macht das
automatisch aus den Angaben im Steckbrief (`bird.yml` oder `butterfly.yml`; für
Schmetterlinge gilt alles hier genauso).

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
**und** `.photo-source` (der Vermerk, von welcher Commons-Datei das Foto stammt; ohne
ihn wird ein Commons-Foto nicht angezeigt). Fotos im Repository haben beim
Veröffentlichen immer Vorrang vor dem Zwischenspeicher.

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
content/birds/kahnschnabel
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
z. B. `content/birds/kahnschnabel/bird.yml`.

### Schriften

Die Schriften liegen als Teilmengen (Grundzeichen, Umlaute, westeuropäische Akzente)
unter `assets/fonts/`. Zeichen außerhalb dieser Teilmenge (etwa ő, ł, č oder €) zeigt
der Browser in einer Ersatzschrift an. Für solche Regionen die vollständigen Schriftdateien von
Google Fonts unter denselben Dateinamen ablegen.
