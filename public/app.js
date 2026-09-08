// Küçük yardımcılar: onay isteyen formlar, şablon önizleme, sağlayıcı alanları, mobil menü
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (f && f.dataset && f.dataset.confirm) {
    if (!window.confirm(f.dataset.confirm)) e.preventDefault();
  }
});

(function () {
  var ta = document.getElementById('template');
  var out = document.getElementById('template-preview');
  if (!ta || !out) return;
  var sample = {
    sahip: 'Ayşe Yılmaz', hayvan: 'Boncuk', tarih: '15.10.2026', tur: 'Kuduz aşısı',
    klinik: out.dataset.clinic || 'Kliniğiniz', klinik_tel: out.dataset.phone || '0212 000 00 00',
  };
  function render() {
    var t = ta.value.replace(/\{(\w+)\}/g, function (m, k) { return sample[k] != null ? sample[k] : m; });
    out.textContent = t;
    var len = document.getElementById('template-len');
    if (len) len.textContent = t.length + ' karakter';
  }
  ta.addEventListener('input', render);
  render();
})();

(function () {
  var sel = document.getElementById('sms_provider');
  if (!sel) return;
  function update() {
    var v = sel.value;
    document.querySelectorAll('.provider-fields, .provider-help').forEach(function (el) {
      el.classList.toggle('hidden', el.dataset.provider !== v);
    });
  }
  sel.addEventListener('change', update);
  update();
})();

// Mobil gezinme: hamburger düğmesi
(function () {
  var bar = document.querySelector('.topbar');
  var toggle = bar && bar.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!bar || !toggle || !nav) return;

  var wide = window.matchMedia('(min-width: 861px)');

  function isOpen() { return bar.classList.contains('nav-open'); }
  function setOpen(open) {
    bar.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () { setOpen(!isOpen()); });

  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (t.closest('.nav-toggle')) return;
    if (nav.contains(t)) {
      // bağlantıya ya da düğmeye dokunulduysa menüyü kapat
      if (t.closest('a') || t.closest('button')) setOpen(false);
      return;
    }
    setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!isOpen()) return;
    setOpen(false);
    toggle.focus();
  });

  function syncWidth() { if (wide.matches) setOpen(false); }
  if (typeof wide.addEventListener === 'function') wide.addEventListener('change', syncWidth);
  else if (typeof wide.addListener === 'function') wide.addListener(syncWidth);
  syncWidth();
})();
