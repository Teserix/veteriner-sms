/* Karşılama turu: data-tour="..." işaretli öğeleri sırayla tanıtır.
 * Otomatik açılış: body[data-tour-auto="1"]; elle: [data-tour-start].
 * Bitirme ya da atlamada bir kez POST /tur/goruldu (CSRF <meta name="csrf-token"> içinden).
 * Bağımlılık ve satır içi stil/betik yok (CSP); konum CSSOM ile verilir. */
(function () {
  'use strict';

  var STEPS = [
    { key: 'hizli-kayit', href: '/hizli-kayit', title: 'Hızlı kayıt', text: 'Hasta sahibi, hayvan ve ilk hatırlatmayı tek formda kaydedin.' },
    { key: 'hatirlatmalar', href: '/hatirlatmalar', title: 'Hatırlatmalar', text: 'Yaklaşan aşı ve kontrol hatırlatmalarını görün, gerekirse elle gönderin.' },
    { key: 'sahipler', href: '/sahipler', title: 'Hasta sahipleri', text: 'Sahipleri ve hayvanlarını arayın, bilgilerini ve SMS iznini düzenleyin.' },
    { key: 'sms', href: '/sms', title: 'SMS geçmişi', text: 'Gönderilen mesajların durumunu ve içeriğini izleyin.' },
    { key: 'ayarlar', href: '/ayarlar', title: 'Ayarlar', text: 'Klinik bilgileri, SMS sağlayıcısı ve mesaj şablonlarını yönetin.' },
  ];
  var GAP = 12;

  var panel = null;
  var backdrop = null;
  var steps = STEPS;
  var inerted = [];
  var current = 0;
  var target = null;
  var lastFocus = null;
  var reported = false;
  var els = {};

  function csrfToken() {
    var m = document.querySelector('meta[name="csrf-token"]');
    return m ? m.getAttribute('content') || '' : '';
  }

  function report() {
    if (reported) return;
    reported = true;
    var token = csrfToken();
    if (!token || !window.fetch) return;
    try {
      fetch('/tur/goruldu', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: '_csrf=' + encodeURIComponent(token),
      }).catch(function () {});
    } catch (e) { /* ağ hatası sessizce yutulur */ }
  }

  function visible(el) {
    if (!el || !el.getClientRects().length) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.right <= 0 || r.left >= window.innerWidth) return false; // kapalı çekmece menü
    return window.getComputedStyle(el).visibility !== 'hidden';
  }

  function firstVisible(selector) {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) if (visible(list[i])) return list[i];
    return null;
  }

  // Önce adımın kendi işareti; yoksa (mobil/tablet) görünür menü düğmesi yedek hedef olur.
  function findTarget(step) {
    var own = firstVisible('[data-tour="' + step.key + '"]');
    if (own) return { el: own, fallback: false };
    var menu = firstVisible('.nav-toggle');
    return menu ? { el: menu, fallback: true } : { el: null, fallback: false };
  }

  // Personel Ayarlar'a erişemez; o adım listeden çıkarılır.
  function activeSteps() {
    var staff = document.body && document.body.dataset.role === 'staff';
    return STEPS.filter(function (s) { return !(staff && s.key === 'ayarlar'); });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function build() {
    panel = el('div', 'tour-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'tour-title');
    panel.setAttribute('aria-describedby', 'tour-text');
    els.count = el('p', 'tour-count');
    els.count.setAttribute('aria-live', 'polite');
    els.title = el('h2', 'tour-title');
    els.title.id = 'tour-title';
    els.text = el('p', 'tour-text');
    els.text.id = 'tour-text';
    var actions = el('div', 'tour-actions');
    els.skip = el('button', 'btn ghost tour-skip', 'Atla');
    els.prev = el('button', 'btn secondary', 'Geri');
    els.next = el('button', 'btn', 'İleri');
    [els.skip, els.prev, els.next].forEach(function (b) { b.type = 'button'; actions.appendChild(b); });
    panel.appendChild(els.count);
    panel.appendChild(els.title);
    panel.appendChild(els.text);
    panel.appendChild(actions);

    els.skip.addEventListener('click', function () { close(); });
    els.prev.addEventListener('click', function () { go(current - 1); });
    els.next.addEventListener('click', function () {
      if (current >= steps.length - 1) close();
      else go(current + 1);
    });
    backdrop = el('div', 'tour-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  }

  // Panel ve perde dışındaki body çocukları inert; önceden inert olanlara dokunulmaz.
  function inertBackground() {
    inerted = [];
    Array.prototype.forEach.call(document.body.children, function (c) {
      if (c === panel || c === backdrop || c.inert) return;
      c.inert = true;
      inerted.push(c);
    });
  }

  function restoreBackground() {
    inerted.forEach(function (c) { c.inert = false; });
    inerted = [];
  }

  function onFocusIn(e) {
    if (!panel || panel.contains(e.target)) return;
    var f = focusables();
    var to = els.next && !els.next.disabled ? els.next : f[0];
    if (to) to.focus();
  }

  function focusables() {
    return Array.prototype.filter.call(panel.querySelectorAll('button'), function (b) { return !b.disabled; });
  }

  // Belge düzeyinde capture: Esc app.js'teki çekmece/menü dinleyicilerine ulaşmaz.
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    var inside = panel.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  function clearTarget() {
    if (target) target.classList.remove('tour-target');
    target = null;
  }

  function sheet() {
    return window.matchMedia('(max-width: 700px)').matches; // sekme çubuğu eşiğiyle aynı
  }

  function place() {
    var s = panel.style;
    s.top = s.left = '';
    panel.classList.toggle('is-centered', !target && !sheet());
    if (!target || sheet()) return;
    var r = target.getBoundingClientRect();
    var pw = panel.offsetWidth;
    var ph = panel.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left;
    var top;
    if (r.right + GAP + pw <= vw - GAP) { // sağında yer varsa (sidebar)
      left = r.right + GAP;
      top = r.top;
    } else { // altına, sığmazsa üstüne
      left = r.left;
      top = r.bottom + GAP + ph <= vh - GAP ? r.bottom + GAP : r.top - GAP - ph;
    }
    s.left = Math.max(GAP, Math.min(left, vw - pw - GAP)) + 'px';
    s.top = Math.max(GAP, Math.min(top, vh - ph - GAP)) + 'px';
  }

  function go(i) {
    if (i < 0 || i >= steps.length) return;
    current = i;
    var step = steps[i];
    clearTarget();
    var found = findTarget(step);
    target = found.el;
    if (target) {
      target.classList.add('tour-target');
      try { target.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } catch (e) { target.scrollIntoView(); }
    }
    els.count.textContent = 'Adım ' + (i + 1) + '/' + steps.length;
    els.title.textContent = step.title;
    els.text.textContent = step.text + (found.fallback ? ' Menü düğmesinden ulaşabilirsiniz.' : '');
    els.prev.disabled = i === 0;
    els.next.textContent = i === steps.length - 1 ? 'Bitir' : 'İleri';
    place();
    els.next.focus();
  }

  var SCROLL_OPTS = { passive: true, capture: true };

  function open() {
    if (panel) return;
    lastFocus = document.activeElement;
    steps = activeSteps();
    build();
    inertBackground();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, SCROLL_OPTS);
    go(0);
  }

  function close() {
    if (!panel) return;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocusIn, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, SCROLL_OPTS);
    restoreBackground();
    clearTarget();
    panel.remove();
    panel = null;
    if (backdrop) backdrop.remove();
    backdrop = null;
    report();
    // Odak açılıştaki öğeye; belgeden kalkmışsa ana içeriğe (yoksa body'ye) döner.
    var back = lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus) && lastFocus !== document.body
      ? lastFocus : null;
    if (!back) {
      back = document.querySelector('main#main') || document.body;
      if (!back.hasAttribute('tabindex')) back.setAttribute('tabindex', '-1');
    }
    back.focus();
    lastFocus = null;
  }

  function init() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-tour-start]') : null;
      if (!t) return;
      e.preventDefault();
      reported = false; // yeniden başlatılan tur yeniden işaretlenebilir (sunucuda idempotent)
      open();
    });
    if (document.body && document.body.dataset.tourAuto === '1') open();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
