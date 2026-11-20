// Regionsseiten: „Vogel gesehen?“ bzw. „Schmetterling gesehen?“ (Arten nach Ähnlichkeit
// sortieren), Bilder zum Wischen (Zeichnung, Illustration, Foto) in der Artenliste und im
// Steckbrief und kleine Hilfen für die Navigation zwischen den Seiten einer Region.
(function (root) {
  'use strict';

  // ---------- Bewertung (ohne DOM; die Tests rufen diese Funktionen direkt auf) ----------
  //
  // Jede Angabe ergibt einen Wert zwischen 0 und 1: 1 = passt, etwa 0,5 = angrenzend
  // oder ähnlich, klein = passt nicht. Alle Angaben gelten zusammen (und), deshalb
  // werden die Werte multipliziert. Ein Mindestwert sorgt dafür, dass eine
  // unpassende Angabe die übrigen nicht auslöscht: Es bleibt eine Sortierung.

  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var FLOOR = 0.05;
  var SIZE_SPREAD = 0.25; // Abstand im Logarithmus; 0,25 ≈ ein Viertel größer oder kleiner
  var TIER_GOOD = 0.85;
  var TIER_SOME = 0.25;

  function part(score, text, level) {
    return {
      score: Math.max(FLOOR, score),
      level: level || (score >= TIER_GOOD ? 'ja' : score >= 0.3 ? 'nah' : 'nein'),
      text: text,
    };
  }

  /** months: Liste der Monate (1–12), in denen die Art da ist; null = ganzjährig. */
  function monthPart(months, m) {
    var name = MONTHS[m - 1];
    if (!months || months.indexOf(m) >= 0) return part(1, 'im ' + name);
    for (var d = 1; d < 12; d++) {
      var later = ((m - 1 + d) % 12) + 1;
      var earlier = ((m - 1 - d + 24) % 12) + 1;
      var hasLater = months.indexOf(later) >= 0;
      if (hasLater || months.indexOf(earlier) >= 0) {
        if (d === 1) return part(0.5, hasLater ? 'erst ab ' + MONTHS[later - 1] : 'nur bis ' + MONTHS[earlier - 1]);
        return part(d === 2 ? 0.2 : 0, 'nicht im ' + name);
      }
    }
    return part(0, 'nicht im ' + name);
  }

  function cm(n) {
    return String(n).replace('.', ',');
  }

  function lengthText(len) {
    return len[0] === len[1] ? 'ca. ' + cm(len[0]) + ' cm' : cm(len[0]) + '–' + cm(len[1]) + ' cm';
  }

  /** len: [min, max] in cm oder null; cls: { min, max } der gewählten Größenklasse (max 0 = offen). */
  function sizePart(len, cls) {
    if (!len) return part(0.5, 'Größe unbekannt', 'offen');
    var lo = cls.min || 0;
    var hi = cls.max || Infinity;
    var d = 0;
    var bigger = false;
    if (len[0] > hi) {
      d = Math.log(len[0] / hi);
      bigger = true;
    } else if (len[1] < lo) {
      d = Math.log(lo / len[1]);
    }
    var x = d / SIZE_SPREAD;
    var s = Math.exp(-x * x);
    if (s >= TIER_GOOD) return part(s, 'Größe passt (' + lengthText(len) + ')');
    return part(s, (s >= 0.3 ? 'etwas ' : 'viel ') + (bigger ? 'größer' : 'kleiner') + ' (' + lengthText(len) + ')');
  }

  /**
   * groups: Lebensräume der Art (ids, der erste ist der wichtigste) oder null;
   * id: gewählter Lebensraum; habitats[id] = { label }.
   */
  function habitatPart(groups, id, habitats) {
    if (!groups || !groups.length) return part(0.5, 'Lebensraum unbekannt', 'offen');
    if (groups.indexOf(id) >= 0) return part(1, habitats[id].label);
    var own = habitats[groups[0]];
    return part(0.15, 'eher „' + (own ? own.label : groups[0]) + '“');
  }

  /** sites: Orte (Indizes), an denen die Art typisch ist; places[i] = { name, near: [Indizes] }. */
  function placePart(sites, i, places) {
    var place = places[i];
    if (sites.indexOf(i) >= 0) return part(1, 'typisch für ' + place.name);
    for (var k = 0; k < place.near.length; k++) {
      if (sites.indexOf(place.near[k]) >= 0) return part(0.6, 'typisch für Nachbarort ' + places[place.near[k]].name);
    }
    if (!sites.length) return part(0.5, 'keinem Ort zugeordnet', 'offen');
    return part(0.15, 'eher bei ' + places[sites[0]].name);
  }

  /** colors: Farben der Art oder null; wanted: gewählte Farben; palette[id] = { label, near }. */
  function colorParts(colors, wanted, palette) {
    if (!colors) return { score: 0.5, parts: [part(0.5, 'Farben unbekannt', 'offen')] };
    var sum = 0;
    var parts = [];
    wanted.forEach(function (c) {
      var info = palette[c];
      if (colors.indexOf(c) >= 0) {
        sum += 1;
        parts.push(part(1, info.label));
        return;
      }
      var alt = info.near.filter(function (n) { return colors.indexOf(n) >= 0; })[0];
      if (alt) {
        sum += 0.5;
        parts.push(part(0.5, palette[alt].label + ' statt ' + info.label));
      } else {
        parts.push(part(0, 'kein ' + info.label));
      }
    });
    return { score: Math.max(FLOOR, sum / wanted.length), parts: parts };
  }

  /**
   * bird: { colors, len, groups, sites, months }; q: { colors, size, habitat, site, month };
   * ctx: { colors, habitats, places }. Liefert { score, tier (0 gut, 1 teilweise, 2 kaum), parts }.
   * Die Reihenfolge der Teile folgt der Reihenfolge der Fragen auf der Seite.
   */
  function rate(bird, q, ctx) {
    var score = 1;
    var parts = [];
    function use(p) {
      score *= p.score;
      parts.push(p);
    }
    if (q.colors && q.colors.length) {
      var c = colorParts(bird.colors, q.colors, ctx.colors);
      score *= c.score;
      parts = parts.concat(c.parts);
    }
    if (q.size) use(sizePart(bird.len, q.size));
    if (q.habitat && ctx.habitats && ctx.habitats[q.habitat]) use(habitatPart(bird.groups, q.habitat, ctx.habitats));
    if (q.site != null && ctx.places[q.site]) use(placePart(bird.sites || [], q.site, ctx.places));
    if (q.month) use(monthPart(bird.months, q.month));
    return { score: score, tier: score >= TIER_GOOD ? 0 : score >= TIER_SOME ? 1 : 2, parts: parts };
  }

  root.Vogelfuehrer = {
    rate: rate,
    monthPart: monthPart,
    sizePart: sizePart,
    habitatPart: habitatPart,
    placePart: placePart,
    colorParts: colorParts,
  };
  if (typeof document === 'undefined') return;

  // ---------- Seite ----------

  var all = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var nums = function (s) { return s == null ? null : s.split(' ').filter(Boolean).map(Number); };
  var words = function (s) { return s ? s.split(' ').filter(Boolean) : null; };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var finder = document.getElementById('finder');
  var grid = document.querySelector('#arten .grid');
  var navFind = document.querySelector('.regnav .nav-find');
  var home = !!(finder && grid);

  // Die Auswahl in „Vogel gesehen?“ gilt für diesen Tab: Links zurück zur Artenliste
  // (Menü, „← Alle Arten“) nehmen sie mit, damit die Sortierung erhalten bleibt.
  function storeKey(pathname) {
    return 'vogelfuehrer:auswahl:' + pathname;
  }
  function stored(pathname) {
    try {
      return window.sessionStorage.getItem(storeKey(pathname)) || '';
    } catch (e) {
      return '';
    }
  }
  function store(pathname, search) {
    try {
      if (search) window.sessionStorage.setItem(storeKey(pathname), search);
      else window.sessionStorage.removeItem(storeKey(pathname));
    } catch (e) {
      // ohne Speicher (privater Modus) bleibt es bei der Adresse
    }
  }
  // Einmal-Merker im sessionStorage: take() liest und löscht
  function put(key, value) {
    try {
      window.sessionStorage.setItem('vogelfuehrer:' + key, value);
    } catch (e) {
      // ohne Speicher entfällt die Annehmlichkeit
    }
  }
  function take(key) {
    try {
      var v = window.sessionStorage.getItem('vogelfuehrer:' + key);
      window.sessionStorage.removeItem('vogelfuehrer:' + key);
      return v;
    } catch (e) {
      return null;
    }
  }

  if (home) {
    // Alte Adressen der früheren Einzelseite (…/ometepe/#orte, …/ometepe/#fischadler) weiterleiten
    var hash = '';
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch (e) {
      hash = '';
    }
    if (hash) {
      var moved = all('.regnav a[data-old]').filter(function (a) { return a.dataset.old === hash; })[0];
      var card = document.getElementById(hash);
      var cardLink = card && card.classList.contains('bird') && card.querySelector('.bird-name a');
      if (moved || cardLink) {
        // Die Hauptseite wird ersetzt: „← Alle Arten“ darf dort nicht per Zurück hinführen
        put('weitergeleitet', new URL((moved || cardLink).href).pathname);
        location.replace((moved || cardLink).href);
        return;
      }
    }
  } else if (navFind) {
    var target = new URL(navFind.href, location.href);
    var saved = stored(target.pathname);
    if (saved && window.URLSearchParams) {
      all('a[href]').forEach(function (a) {
        var u = new URL(a.getAttribute('href'), location.href);
        if (u.origin !== location.origin || u.pathname !== target.pathname) return;
        var own = new URLSearchParams(u.search);
        var keys = [];
        own.forEach(function (v, k) { keys.push(k); });
        if (keys.some(function (k) { return k !== 'ort'; })) return;
        var p = new URLSearchParams(saved);
        if (own.get('ort')) p.set('ort', own.get('ort'));
        a.href = u.pathname + '?' + p.toString() + u.hash;
      });
    }
  }

  // „← Alle Arten“: Wer direkt von der Artenliste kommt, geht zurück (Position und Sortierung
  // bleiben). Der Merker steht im Verlaufseintrag dieser Seite; Einträge mit Sprungmarke
  // (#inhalt) und Weiterleitungen alter Adressen haben ihn nicht und folgen dem Link.
  var backLinks = all('a[data-back]');
  if (backLinks.length && window.history && history.replaceState) {
    var redirected = take('weitergeleitet') === location.pathname;
    try {
      var ref = document.referrer ? new URL(document.referrer) : null;
      var list = new URL(backLinks[0].href, location.href);
      if (!redirected && !history.state && ref && ref.origin === location.origin && ref.pathname === list.pathname) {
        history.replaceState({ vogelfuehrerAusListe: true }, '');
      }
    } catch (err) {
      // ohne Merker bleibt es beim normalen Link
    }
  }
  backLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (history.state && history.state.vogelfuehrerAusListe) {
        e.preventDefault();
        history.back();
      }
    });
  });

  function dotsFor(n) {
    var d = document.createElement('div');
    d.className = 'tdots';
    d.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < n; i++) d.appendChild(document.createElement('span'));
    return d;
  }
  function setDot(dots, i) {
    Array.prototype.forEach.call(dots.children, function (s, k) { s.classList.toggle('on', k === i); });
  }
  // Genaue Position einer Ansicht in ihrer Leiste (Breiten mit Nachkommastellen: k * clientWidth
  // ließe einen Haarstrich der Nachbaransicht stehen)
  function offsetIn(track, fig) {
    return fig.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
  }
  function indexIn(track, figs) {
    var w = figs[0] ? figs[0].getBoundingClientRect().width : track.clientWidth;
    return Math.max(0, Math.min(figs.length - 1, Math.round(track.scrollLeft / (w || 1))));
  }
  function eager(fig) {
    all('img', fig).forEach(function (img) { img.loading = 'eager'; });
  }

  // Vorschaubilder in der Artenliste: Wischen (oder die Pfeile am Rand) wechselt zwischen
  // Zeichnung, Illustration und Foto; ein Tipp aufs Bild öffnet den Steckbrief.
  // Nach dem Umsortieren stellt thumbSync die Position wieder her (verschobene Elemente
  // verlieren ihre Scrollposition).
  var thumbSync = [];
  all('.bird .thumb').forEach(function (thumb) {
    var frame = thumb.querySelector('.tframe');
    var track = thumb.querySelector('.tslides');
    var link = thumb.parentNode.querySelector('.bird-name a');
    if (!frame || !track || !link) return;
    var figs = Array.prototype.slice.call(track.children);
    var current = 0;
    // Der Steckbrief öffnet mit der Ansicht, die die Karte gerade zeigt (Zeichnung, Foto …)
    function remember() {
      var fig = figs[current];
      if (fig && fig.dataset.view) put('ansicht', new URL(link.href, location.href).pathname + '|' + fig.dataset.view);
    }
    thumb.classList.add('live');
    link.addEventListener('click', remember);
    thumb.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.tnav')) return;
      remember();
      if (e.ctrlKey || e.metaKey || e.shiftKey) window.open(link.href, '_blank', 'noopener');
      else location.href = link.href;
    });
    if (figs.length < 2) return;
    var timer;
    var dots = dotsFor(figs.length);
    frame.appendChild(dots);
    function mark(i) {
      current = i;
      setDot(dots, i);
    }
    function show(k) {
      k = (k + figs.length) % figs.length;
      eager(figs[k]);
      track.scrollTo({ left: offsetIn(track, figs[k]), behavior: calm ? 'auto' : 'smooth' });
      mark(k);
    }
    [['prev', '‹', -1], ['next', '›', 1]].forEach(function (d) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tnav ' + d[0];
      btn.tabIndex = -1;
      btn.setAttribute('aria-hidden', 'true');
      btn.textContent = d[1];
      // Kein Fokus per Maus: sonst bekäme die ganze Karte den Fokusrahmen
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        show(current + d[2]);
      });
      frame.appendChild(btn);
    });
    // Foto und Illustration liegen hinter der Zeichnung: laden, sobald jemand die Karte
    // berührt oder mit der Maus darauf zeigt, damit beim Wischen kein leeres Bild erscheint
    function preload() { figs.forEach(eager); }
    thumb.addEventListener('pointerenter', preload, { once: true });
    thumb.addEventListener('touchstart', preload, { once: true, passive: true });
    track.addEventListener('scroll', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var k = indexIn(track, figs);
        if (k !== current) eager(figs[k]);
        mark(k);
      }, 80);
    });
    mark(0);
    thumbSync.push(function () { track.scrollLeft = offsetIn(track, figs[current]); });
  });
  window.addEventListener('resize', function () {
    thumbSync.forEach(function (f) { f(); });
  });

  // Ansichten im Steckbrief: Knöpfe oder Klick auf das Bild schalten weiter
  all('.media').forEach(function (media) {
    var tabs = media.nextElementSibling && media.nextElementSibling.classList.contains('tabs') ? media.nextElementSibling : null;
    var slides = media.querySelector('.slides');
    if (!tabs || !slides) return;
    var tb = all('button', tabs);
    var figs = Array.prototype.slice.call(slides.children);
    var current = 0;
    var timer;
    // Punkte zeigen, dass man wischen kann (die Knöpfe darunter sind für Maus und Tastatur)
    var dots = dotsFor(figs.length);
    media.appendChild(dots);
    function mark(i) {
      current = i;
      tb.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
      setDot(dots, i);
      slides.title = 'Klicken oder wischen: ' + tb[(i + 1) % tb.length].textContent + ' zeigen';
    }
    function show(k, instant) {
      eager(figs[k]);
      slides.scrollTo({ left: offsetIn(slides, figs[k]), behavior: calm || instant ? 'auto' : 'smooth' });
      mark(k);
    }
    tabs.hidden = false;
    slides.classList.add('cycle');
    mark(0);
    var wanted = (take('ansicht') || '').split('|');
    if (wanted[0] === location.pathname) {
      var start = tb.map(function (b) { return b.textContent; }).indexOf(wanted[1]);
      if (start > 0) show(start, true);
    }
    tb.forEach(function (b, k) {
      b.addEventListener('click', function () { show(k); });
    });
    slides.addEventListener('click', function (e) {
      // Alt+Klick ist in der Vorschau für Koordinaten reserviert
      if (e.altKey || e.defaultPrevented) return;
      show((current + 1) % figs.length);
    });
    slides.addEventListener('scroll', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { mark(indexIn(slides, figs)); }, 90);
    });
    window.addEventListener('resize', function () {
      slides.scrollTo({ left: offsetIn(slides, figs[current]), behavior: 'auto' });
    });
  });

  if (home) initFinder();

  function initFinder() {
    var q = { colors: [], size: null, habitat: null, site: null, month: null };
    var ctx = { colors: Object.create(null), habitats: Object.create(null), places: [] };
    var status = finder.querySelector('.finder-status');
    var reset = finder.querySelector('.finder-reset');
    var colorBtns = all('[data-c]', finder);
    var sizeBtns = all('[data-s]', finder);
    var habitatBtns = all('[data-l]', finder);
    var siteBtns = all('[data-o]', finder);
    var monthBtns = all('[data-m]', finder);
    var TIERS = ['Passt gut', 'Passt teilweise', 'Passt kaum'];
    var ICON = { ja: '✓', nah: '≈', nein: '✗', offen: '–' };
    var SAY = { ja: 'passt: ', nah: 'teilweise: ', nein: 'passt nicht: ', offen: 'offen: ' };

    colorBtns.forEach(function (b) {
      ctx.colors[b.dataset.c] = { label: b.textContent.trim(), near: words(b.dataset.near) || [] };
    });
    habitatBtns.forEach(function (b) {
      ctx.habitats[b.dataset.l] = { label: b.textContent.trim() };
    });
    siteBtns.forEach(function (b) {
      var n = b.querySelector('.n');
      ctx.places[Number(b.dataset.i)] = {
        name: b.textContent.slice(n ? n.textContent.length : 0).trim(),
        slug: b.dataset.o,
        near: nums(b.dataset.near) || [],
      };
    });
    var now = monthBtns[new Date().getMonth()];
    if (now) {
      now.classList.add('now');
      now.title = 'aktueller Monat';
    }

    // Ausgangsreihenfolge (Überschriften der Lebensräume und Karten) für „Zurücksetzen“
    var initial = Array.prototype.slice.call(grid.children);
    var groupHeads = all('.tier.grp', grid);
    var birds = all('.bird', grid).map(function (c, i) {
      var body = c.querySelector('.bird-body');
      var match = document.createElement('ul');
      match.className = 'match';
      match.hidden = true;
      match.setAttribute('aria-label', 'Übereinstimmung mit deiner Auswahl');
      body.appendChild(match);
      return {
        el: c,
        index: i,
        name: (c.querySelector('.bird-name') || c).textContent.trim(),
        months: nums(c.dataset.months),
        len: nums(c.dataset.len),
        colors: words(c.dataset.colors),
        groups: words(c.dataset.groups),
        sites: nums(c.dataset.sites) || [],
        match: match,
      };
    });
    var tiers = TIERS.map(function () {
      var t = document.createElement('h3');
      t.className = 'tier';
      return t;
    });

    function active() {
      return !!(q.colors.length || q.size || q.habitat || q.site != null || q.month);
    }

    function sync() {
      colorBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(q.colors.indexOf(b.dataset.c) >= 0)); });
      sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(!!q.size && q.size.id === b.dataset.s)); });
      habitatBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(q.habitat === b.dataset.l)); });
      siteBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.i) === q.site)); });
      monthBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.m) === q.month)); });
      reset.disabled = !active();
      finder.classList.toggle('on', active());
      document.body.classList.toggle('finding', active());
    }

    // Die Karte nennt nur, was nicht (ganz) passt; passt alles, steht sie unter „Passt gut“
    // und nennt nichts (für Screenreader ein kurzer Satz).
    function fillMatch(b, r) {
      while (b.match.firstChild) b.match.removeChild(b.match.firstChild);
      var off = r.parts.filter(function (p) { return p.level !== 'ja'; });
      if (!off.length) {
        var whole = document.createElement('li');
        whole.className = 'vh';
        whole.textContent = 'passt zu allen Angaben';
        b.match.appendChild(whole);
      }
      off.forEach(function (p) {
        var li = document.createElement('li');
        li.className = p.level;
        var mark = document.createElement('span');
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = ICON[p.level];
        var say = document.createElement('span');
        say.className = 'vh';
        say.textContent = SAY[p.level];
        li.appendChild(mark);
        li.appendChild(say);
        li.appendChild(document.createTextNode(p.text));
        b.match.appendChild(li);
      });
      b.match.hidden = false;
    }

    function arrange() {
      tiers.forEach(function (t) {
        if (t.parentNode) t.parentNode.removeChild(t);
      });
      status.textContent = '';
      if (!active()) {
        initial.forEach(function (el) { grid.appendChild(el); });
        groupHeads.forEach(function (h) { h.hidden = false; });
        birds.forEach(function (b) {
          b.el.classList.remove('far');
          b.match.hidden = true;
        });
        thumbSync.forEach(function (f) { f(); });
        return;
      }
      groupHeads.forEach(function (h) { h.hidden = true; });
      var rated = birds.map(function (b) { return { b: b, r: rate(b, q, ctx) }; });
      rated.sort(function (x, y) { return y.r.score - x.r.score || x.b.index - y.b.index; });
      var counts = [0, 0, 0];
      rated.forEach(function (x) { counts[x.r.tier]++; });
      if (!rated.length) {
        status.textContent = 'Noch keine Arten.';
        return;
      }
      var first = rated[0].b;
      rated.forEach(function (x) {
        var t = tiers[x.r.tier];
        if (!t.parentNode) {
          t.textContent = TIERS[x.r.tier] + ' ';
          var n = document.createElement('span');
          n.textContent = counts[x.r.tier] + (counts[x.r.tier] === 1 ? ' Art' : ' Arten');
          t.appendChild(n);
          grid.appendChild(t);
        }
        grid.appendChild(x.b.el);
        x.b.el.classList.toggle('far', x.r.tier === 2);
        fillMatch(x.b, x.r);
      });
      thumbSync.forEach(function (f) { f(); });

      var parts = [];
      if (counts[0]) parts.push(counts[0] + (counts[0] === 1 ? ' passt gut' : ' passen gut'));
      if (counts[1]) parts.push(counts[1] + ' teilweise');
      if (counts[2]) parts.push(counts[2] + ' kaum');
      var strong = document.createElement('strong');
      strong.textContent = parts.join(' · ') + '.';
      var top = document.createElement('span');
      top.className = 'top';
      top.textContent = ' Ganz oben: ' + first.name + '.';
      status.appendChild(strong);
      status.appendChild(top);
    }

    function save() {
      if (!window.history || !history.replaceState || !window.URLSearchParams) return;
      var p = new URLSearchParams(location.search);
      ['farben', 'groesse', 'lebensraum', 'ort', 'monat'].forEach(function (k) { p.delete(k); });
      if (q.colors.length) p.set('farben', q.colors.join(' '));
      if (q.size) p.set('groesse', q.size.id);
      if (q.habitat) p.set('lebensraum', q.habitat);
      if (q.site != null) p.set('ort', ctx.places[q.site].slug);
      if (q.month) p.set('monat', String(q.month));
      var s = p.toString();
      history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
      store(location.pathname, s ? '?' + s : '');
    }

    function sizeOf(b) {
      var label = b.firstChild.textContent.trim();
      return { id: b.dataset.s, label: label, say: b.dataset.say || 'wie ' + label, min: Number(b.dataset.min), max: Number(b.dataset.max) };
    }

    function load() {
      if (!window.URLSearchParams) return;
      var p = new URLSearchParams(location.search);
      (p.get('farben') || '').split(/[\s,]+/).forEach(function (c) {
        if (ctx.colors[c] && q.colors.indexOf(c) < 0) q.colors.push(c);
      });
      var s = sizeBtns.filter(function (b) { return b.dataset.s === p.get('groesse'); })[0];
      if (s) q.size = sizeOf(s);
      if (ctx.habitats[p.get('lebensraum')]) q.habitat = p.get('lebensraum');
      ctx.places.forEach(function (pl, i) {
        if (pl.slug === p.get('ort')) q.site = i;
      });
      var m = Number(p.get('monat'));
      if (m >= 1 && m <= 12) q.month = m;
    }

    finder.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b || !finder.contains(b)) return;
      if (b.dataset.c) {
        var k = q.colors.indexOf(b.dataset.c);
        if (k >= 0) q.colors.splice(k, 1);
        else q.colors.push(b.dataset.c);
      } else if (b.dataset.s) {
        q.size = q.size && q.size.id === b.dataset.s ? null : sizeOf(b);
      } else if (b.dataset.l) {
        q.habitat = q.habitat === b.dataset.l ? null : b.dataset.l;
      } else if (b.dataset.o) {
        var i = Number(b.dataset.i);
        q.site = q.site === i ? null : i;
      } else if (b.dataset.m) {
        var m = Number(b.dataset.m);
        q.month = q.month === m ? null : m;
      } else if (b === reset) {
        q = { colors: [], size: null, habitat: null, site: null, month: null };
      } else {
        return;
      }
      var wasReset = b === reset;
      if (wasReset) {
        // Der Knopf wird gleich deaktiviert: Fokus an den Anfang des Feldes, Ergebnis ansagen
        finderHead.focus();
      }
      sync();
      arrange();
      save();
      place();
      if (wasReset) status.textContent = 'Auswahl zurückgesetzt. Alle ' + birds.length + ' Arten nach Lebensraum.';
      // Liegt der Anfang der Liste oben außerhalb des Bildes (Feld in der mitlaufenden Spalte),
      // zu den Treffern springen; sonst sähe man nur die hinteren Arten
      var list = document.getElementById('arten');
      if (list && list.getBoundingClientRect().top < barHeight()) list.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
    });

    // Mitlaufende Spalte (ab 1000px): passt das Feld nicht ins Fenster, läuft es mit der Seite
    // und bleibt erst mit seinem unteren Rand stehen, so bleiben alle Angaben erreichbar
    function barHeight() {
      var bar = document.querySelector('.bar');
      return bar && getComputedStyle(document.querySelector('.head')).position === 'sticky' ? bar.getBoundingClientRect().height : 0;
    }
    function place() {
      if (!window.matchMedia || !window.matchMedia('(min-width: 1000px)').matches) {
        finder.style.removeProperty('--finder-top');
        return;
      }
      var top = Math.min(barHeight() + 16, window.innerHeight - finder.offsetHeight - 16);
      finder.style.setProperty('--finder-top', top + 'px');
    }
    window.addEventListener('resize', place);
    var finderHead = document.getElementById('finder-h') || finder;

    // Im Menü führt „Vogel gesehen?“ auf dieser Seite zum Feld, ohne die Auswahl zu verlieren
    if (navFind) navFind.setAttribute('href', '#finder');

    load();
    finder.hidden = false;
    sync();
    arrange();
    place();
    store(location.pathname, active() ? location.search : '');
    // Das Feld war beim Laden noch verborgen; Sprungziele jetzt anfahren
    if (location.hash === '#finder' || location.hash === '#arten') {
      var el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ block: 'start' });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
