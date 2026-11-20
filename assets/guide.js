// Filter nach Lebensraum und Umschalter Zeichnung/Foto auf den Regionsseiten.
(function () {
  var btns = document.querySelectorAll('.filters button');
  var cards = document.querySelectorAll('.bird');

  function setFilter(g) {
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.g === g)); });
    cards.forEach(function (c) { c.hidden = !(g === 'alle' || c.dataset.group === g); });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () { setFilter(b.dataset.g); });
  });
  // Links auf eine Art (z. B. bei den Orten) zeigen immer alle Arten, damit das Ziel sichtbar ist
  document.querySelectorAll('a[data-bird]').forEach(function (a) {
    a.addEventListener('click', function () { setFilter('alle'); });
  });
  if (location.hash && btns.length) setFilter('alle');

  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cards.forEach(function (card) {
    var tabs = card.querySelector('.tabs');
    var slides = card.querySelector('.slides');
    if (!tabs || !slides) return;
    var tb = tabs.querySelectorAll('button');
    var img = card.querySelector('.slide.photo img');
    var timer;
    function mark(i) {
      tb.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
    }
    tabs.hidden = false;
    tb.forEach(function (b, k) {
      b.addEventListener('click', function () {
        if (img && k > 0) img.loading = 'eager';
        slides.scrollTo({ left: k * slides.clientWidth, behavior: calm ? 'auto' : 'smooth' });
        mark(k);
      });
    });
    slides.addEventListener('scroll', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { mark(Math.round(slides.scrollLeft / slides.clientWidth)); }, 90);
    });
  });
})();
