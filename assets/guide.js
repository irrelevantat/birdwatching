// Regionsseiten: Lebensraum-Filter, „Vogel gesehen?“ bzw. „Schmetterling gesehen?“ (Arten
// nach Ähnlichkeit sortieren) und Umschalter zwischen Zeichnung, Illustration und Foto.
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
   * bird: { months, len, colors, sites }; q: { month, size, site, colors };
   * ctx: { places, colors }. Liefert { score, tier (0 gut, 1 teilweise, 2 kaum), parts }.
   */
  function rate(bird, q, ctx) {
    var score = 1;
    var parts = [];
    function use(p) {
      score *= p.score;
      parts.push(p);
    }
    if (q.month) use(monthPart(bird.months, q.month));
    if (q.size) use(sizePart(bird.len, q.size));
    if (q.site != null && ctx.places[q.site]) use(placePart(bird.sites || [], q.site, ctx.places));
    if (q.colors && q.colors.length) {
      var c = colorParts(bird.colors, q.colors, ctx.colors);
      score *= c.score;
      parts = parts.concat(c.parts);
    }
    return { score: score, tier: score >= TIER_GOOD ? 0 : score >= TIER_SOME ? 1 : 2, parts: parts };
  }

  root.Vogelfuehrer = { rate: rate, monthPart: monthPart, sizePart: sizePart, placePart: placePart, colorParts: colorParts };
  if (typeof document === 'undefined') return;

  // ---------- Seite ----------

  var all = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var nums = function (s) { return s == null ? null : s.split(' ').filter(Boolean).map(Number); };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var btns = all('.filters button');
  var cards = all('.bird');
  var grid = document.querySelector('#arten .grid');
  var finder = document.getElementById('finder');
  var group = 'alle';
  var arrange = function () {};

  // Lebensraum-Filter: blendet aus. Die Sortierung von „Vogel gesehen?“ gilt innerhalb davon.
  function setFilter(g) {
    group = g;
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.g === g)); });
    cards.forEach(function (c) { c.hidden = !(g === 'alle' || c.dataset.group === g); });
    arrange();
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () { setFilter(b.dataset.g); });
  });
  // Links auf eine Art (z. B. bei den Orten) zeigen immer alle Arten, damit das Ziel sichtbar ist
  all('a[data-bird]').forEach(function (a) {
    a.addEventListener('click', function () { setFilter('alle'); });
  });
  if (location.hash && btns.length) setFilter('alle');

  // Ansichten einer Karte: Knöpfe oder Klick auf das Bild schalten weiter
  var views = [];
  cards.forEach(function (card) {
    var tabs = card.querySelector('.tabs');
    var slides = card.querySelector('.slides');
    if (!tabs || !slides) return;
    var tb = all('button', tabs);
    var figs = Array.prototype.slice.call(slides.children);
    var current = 0;
    var timer;
    function mark(i) {
      current = i;
      tb.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
      slides.title = 'Klicken: ' + tb[(i + 1) % tb.length].textContent + ' zeigen';
    }
    function show(k, instant) {
      all('img', figs[k]).forEach(function (img) { img.loading = 'eager'; });
      slides.scrollTo({ left: k * slides.clientWidth, behavior: calm || instant ? 'auto' : 'smooth' });
      mark(k);
    }
    tabs.hidden = false;
    slides.classList.add('cycle');
    mark(0);
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
      timer = setTimeout(function () { mark(Math.round(slides.scrollLeft / slides.clientWidth)); }, 90);
    });
    // Beim Umsortieren verlieren verschobene Elemente ihre Scrollposition
    views.push(function () { show(current, true); });
  });

  if (finder && grid) initFinder();

  function initFinder() {
    var q = { month: null, size: null, site: null, colors: [] };
    var ctx = { places: [], colors: {} };
    var status = finder.querySelector('.finder-status');
    var picked = finder.querySelector('.finder-picked');
    var reset = finder.querySelector('.finder-reset');
    var monthBtns = all('[data-m]', finder);
    var sizeBtns = all('[data-s]', finder);
    var siteBtns = all('[data-o]', finder);
    var colorBtns = all('[data-c]', finder);
    var TIERS = ['Passt gut', 'Passt teilweise', 'Passt kaum'];
    var ICON = { ja: '✓', nah: '≈', nein: '✗', offen: '–' };
    var SAY = { ja: 'passt: ', nah: 'teilweise: ', nein: 'passt nicht: ', offen: 'offen: ' };

    colorBtns.forEach(function (b) {
      ctx.colors[b.dataset.c] = { label: b.textContent.trim(), near: (b.dataset.near || '').split(' ').filter(Boolean) };
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

    var birds = cards.map(function (c, i) {
      var body = c.querySelector('.bird-body');
      var match = document.createElement('ul');
      match.className = 'match';
      match.hidden = true;
      match.setAttribute('aria-label', 'Übereinstimmung mit deinen Angaben');
      body.insertBefore(match, body.firstChild);
      return {
        el: c,
        index: i,
        name: (c.querySelector('h3') || c).textContent.trim(),
        months: nums(c.dataset.months),
        len: nums(c.dataset.len),
        colors: c.dataset.colors ? c.dataset.colors.split(' ') : null,
        sites: nums(c.dataset.sites) || [],
        match: match,
      };
    });
    var tiers = TIERS.map(function () {
      var t = document.createElement('p');
      t.className = 'tier';
      t.hidden = true;
      return t;
    });

    function active() {
      return !!(q.month || q.size || q.site != null || q.colors.length);
    }

    function sync() {
      monthBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.m) === q.month)); });
      sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(!!q.size && q.size.id === b.dataset.s)); });
      siteBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.i) === q.site)); });
      colorBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(q.colors.indexOf(b.dataset.c) >= 0)); });
      var bits = [];
      if (q.month) bits.push(MONTHS[q.month - 1]);
      if (q.size) bits.push(q.size.say);
      if (q.site != null) bits.push(ctx.places[q.site].name);
      if (q.colors.length) bits.push(q.colors.map(function (c) { return ctx.colors[c].label; }).join(', '));
      picked.textContent = bits.join(' · ');
      reset.disabled = !active();
      finder.classList.toggle('on', active());
    }

    function fillMatch(b, r) {
      while (b.match.firstChild) b.match.removeChild(b.match.firstChild);
      r.parts.forEach(function (p) {
        var li = document.createElement('li');
        li.className = p.level;
        var icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = ICON[p.level];
        var say = document.createElement('span');
        say.className = 'vh';
        say.textContent = SAY[p.level];
        li.appendChild(icon);
        li.appendChild(say);
        li.appendChild(document.createTextNode(p.text));
        b.match.appendChild(li);
      });
      b.match.hidden = false;
    }

    arrange = function () {
      tiers.forEach(function (t) {
        t.hidden = true;
        t.removeAttribute('id');
        if (t.parentNode) t.parentNode.removeChild(t);
      });
      if (!active()) {
        birds.forEach(function (b) {
          b.el.classList.remove('far');
          b.match.hidden = true;
          grid.appendChild(b.el);
        });
        status.textContent = '';
        views.forEach(function (v) { v(); });
        return;
      }
      var rated = birds.map(function (b) { return { b: b, r: rate(b, q, ctx) }; });
      rated.sort(function (x, y) { return y.r.score - x.r.score || x.b.index - y.b.index; });
      var counts = [0, 0, 0];
      rated.forEach(function (x) {
        if (!x.b.el.hidden) counts[x.r.tier]++;
      });
      var first = null;
      rated.forEach(function (x) {
        var t = tiers[x.r.tier];
        if (!x.b.el.hidden && t.hidden) {
          t.hidden = false;
          t.innerHTML = '';
          t.appendChild(document.createTextNode(TIERS[x.r.tier] + ' '));
          var n = document.createElement('span');
          n.textContent = counts[x.r.tier] + (counts[x.r.tier] === 1 ? ' Art' : ' Arten');
          t.appendChild(n);
          grid.appendChild(t);
          if (!first) {
            first = x.b;
            t.id = 'treffer';
          }
        }
        grid.appendChild(x.b.el);
        x.b.el.classList.toggle('far', x.r.tier === 2);
        fillMatch(x.b, x.r);
      });
      views.forEach(function (v) { v(); });

      var shown = counts[0] + counts[1] + counts[2];
      var parts = [];
      if (counts[0]) parts.push(counts[0] + (counts[0] === 1 ? ' passt gut' : ' passen gut'));
      if (counts[1]) parts.push(counts[1] + ' teilweise');
      if (counts[2]) parts.push(counts[2] + ' kaum');
      status.innerHTML = '';
      var text = shown ? 'Sortiert: ' + parts.join(', ') + '.' : 'Keine Art in diesem Lebensraum.';
      var label = btns.filter(function (b) { return b.dataset.g === group; })[0];
      if (group !== 'alle' && label) text += ' Nur Lebensraum „' + label.firstChild.textContent.trim() + '“.';
      if (first) text += ' Ganz oben: ' + first.name + '.';
      status.appendChild(document.createTextNode(text + ' '));
      if (first) {
        var a = document.createElement('a');
        a.href = '#treffer';
        a.textContent = 'Zur Liste';
        status.appendChild(a);
      }
    };

    function save() {
      if (!window.history || !history.replaceState || !window.URLSearchParams) return;
      var p = new URLSearchParams(location.search);
      ['monat', 'groesse', 'ort', 'farben'].forEach(function (k) { p.delete(k); });
      if (q.month) p.set('monat', String(q.month));
      if (q.size) p.set('groesse', q.size.id);
      if (q.site != null) p.set('ort', ctx.places[q.site].slug);
      if (q.colors.length) p.set('farben', q.colors.join(' '));
      var s = p.toString();
      history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
    }

    function sizeOf(b) {
      var label = b.firstChild.textContent.trim();
      return { id: b.dataset.s, label: label, say: b.dataset.say || 'wie ' + label, min: Number(b.dataset.min), max: Number(b.dataset.max) };
    }

    function load() {
      if (!window.URLSearchParams) return;
      var p = new URLSearchParams(location.search);
      var m = Number(p.get('monat'));
      if (m >= 1 && m <= 12) q.month = m;
      var s = sizeBtns.filter(function (b) { return b.dataset.s === p.get('groesse'); })[0];
      if (s) q.size = sizeOf(s);
      ctx.places.forEach(function (pl, i) {
        if (pl.slug === p.get('ort')) q.site = i;
      });
      (p.get('farben') || '').split(/[\s,]+/).forEach(function (c) {
        if (ctx.colors[c] && q.colors.indexOf(c) < 0) q.colors.push(c);
      });
    }

    finder.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b || !finder.contains(b)) return;
      if (b.dataset.m) {
        var m = Number(b.dataset.m);
        q.month = q.month === m ? null : m;
      } else if (b.dataset.s) {
        q.size = q.size && q.size.id === b.dataset.s ? null : sizeOf(b);
      } else if (b.dataset.o) {
        var i = Number(b.dataset.i);
        q.site = q.site === i ? null : i;
      } else if (b.dataset.c) {
        var k = q.colors.indexOf(b.dataset.c);
        if (k >= 0) q.colors.splice(k, 1);
        else q.colors.push(b.dataset.c);
      } else if (b === reset) {
        q = { month: null, size: null, site: null, colors: [] };
      } else {
        return;
      }
      sync();
      arrange();
      save();
    });

    // „Hier einen Vogel gesehen?“ bei den Orten übernimmt den Ort
    all('.site-find').forEach(function (b) {
      b.hidden = false;
      b.addEventListener('click', function () {
        ctx.places.forEach(function (pl, i) {
          if (pl.slug === b.dataset.o) q.site = i;
        });
        sync();
        arrange();
        save();
        finder.open = true;
        finder.scrollIntoView({ block: 'start' });
        var target = siteBtns.filter(function (s) { return Number(s.dataset.i) === q.site; })[0];
        if (target) target.focus({ preventScroll: true });
      });
    });

    load();
    finder.hidden = false;
    if (active()) finder.open = true;
    sync();
    arrange();
  }
})(typeof window !== 'undefined' ? window : globalThis);
