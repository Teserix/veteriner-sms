// Küçük yardımcılar: onay isteyen formlar, şablon önizleme, sağlayıcı alanları, menü çekmecesi, işlem menüleri
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (f && f.dataset && f.dataset.confirm) {
    if (!window.confirm(f.dataset.confirm)) e.preventDefault();
  }
});

// SMS-SAYAC-BASLA
// SMS parça hesabı: src/sms/policy.js smsSegments ile birebir aynı (test/sms-counter-parity.test.js doğrular).
// GSM 03.38 temel + genişletme tablosu; Türkçe kaydırma tablosu yok. Temel tabloda olmayan tek karakter
// (ş, ğ, ı, İ...) bütün mesajı UCS-2'ye geçirir (70/67); genişletme karakterleri GSM-7'de 2 birimdir.
var SMS_LIMITS = { gsm7: { single: 160, multi: 153 }, ucs2: { single: 70, multi: 67 } };
var GSM7_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
var GSM7_EXT = '^{}\\[~]|€';
function smsSegments(text) {
  var s = String(text == null ? '' : text);
  var gsmUnits = 0;
  var encoding = 'gsm7';
  // UTF-16 birimi bazında dolaşılır; tablolarda vekil (surrogate) yok, bu yüzden policy.js'teki for...of ile aynı sonuç
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (GSM7_BASIC.indexOf(ch) !== -1) gsmUnits += 1;
    else if (GSM7_EXT.indexOf(ch) !== -1) gsmUnits += 2;
    else { encoding = 'ucs2'; break; }
  }
  var units = encoding === 'gsm7' ? gsmUnits : s.length;
  var single = SMS_LIMITS[encoding].single;
  var multi = SMS_LIMITS[encoding].multi;
  var segments = units === 0 ? 0 : (units <= single ? 1 : Math.ceil(units / multi));
  var perSegment = segments > 1 ? multi : single;
  var remainingInSegment = segments === 0 ? single : segments * perSegment - units;
  return { encoding: encoding, units: units, segments: segments, perSegment: perSegment, remainingInSegment: remainingInSegment };
}
// SMS-SAYAC-BITIS

// Gövde, policy.composeMessage gibi normalize edilir: boşluk dizileri tek boşluk, baş/son boşluk atılır
function smsNormalizeBody(body) { return String(body || '').replace(/\s+/g, ' ').trim(); }

// Önizleme ekranındaki sayaç metni (views/reminder_preview.ejs ilk değeriyle aynı biçim)
function smsCounterText(full, seg) {
  return full.length + ' karakter · ' + seg.segments + ' SMS parçası · ' +
    (seg.encoding === 'gsm7' ? 'GSM-7' : 'Türkçe (UCS-2)') + ' · parçada kalan ' + seg.remainingInSegment;
}

(function () {
  var ta = document.getElementById('template');
  var out = document.getElementById('template-preview');
  if (!ta || !out) return;
  var sample = {
    sahip: 'Ayşe Yılmaz', hayvan: 'Boncuk', tarih: '15.10.2026', tur: 'Kuduz aşısı',
    klinik: out.dataset.clinic || 'Kliniğiniz', klinik_tel: out.dataset.phone || '0212 000 00 00',
  };
  // Sunucunun eklediği kuyruk: "Bilgilendirme:" + kimlik + iptal satırı (src/sms/policy.js ile aynı biçim)
  var tail = [out.dataset.identity || '', out.dataset.optout || ''].filter(Boolean).join(' ');
  var len = document.getElementById('template-len');
  var meter = document.getElementById('template-parts');
  function render() {
    var body = ta.value.replace(/\{(\w+)\}/g, function (m, k) { return sample[k] != null ? sample[k] : m; }).replace(/\s+/g, ' ').trim();
    var t = 'Bilgilendirme: ' + body + (tail ? ' ' + tail : '');
    out.textContent = t;
    var p = smsSegments(t);
    if (len) len.textContent = t.length + ' karakter (kuyruk dahil)';
    if (meter) {
      meter.textContent = p.segments + ' SMS' + (p.encoding === 'ucs2' ? ' · Türkçe karakter var (SMS başına 70/67 karakter)' : ' · SMS başına 160/153 karakter');
      meter.className = 'badge plain ' + (p.segments >= 3 ? 'failed' : (p.segments === 2 ? 'pending' : 'ok'));
    }
  }
  ta.addEventListener('input', render);
  render();
})();

// SMS önizleme ekranı: canlı tam metin, karakter/parça sayacı, "Orijinale dön". Sunucu her durumda yeniden doğrular.
(function () {
  var ta = document.querySelector('[data-sms-body]');
  if (!ta) return;
  var form = ta.form;
  var counter = document.querySelector('[data-sms-counter]');
  var full = document.querySelector('.sms-full');
  var reset = document.querySelector('[data-sms-reset]');
  var submit = form ? form.querySelector('button[type="submit"]') : null;
  // Sunucu engel nedeniyle düğmeyi kapattıysa (kimlik eksik, SMS izni yok...) istemci asla açmaz
  var lockedByServer = submit ? submit.disabled : true;
  var prefix = ta.getAttribute('data-prefix') || '';
  var tail = ta.getAttribute('data-tail') || '';
  var maxTotal = parseInt(ta.getAttribute('data-max-total'), 10) || 0;
  var maxBody = parseInt(ta.getAttribute('maxlength'), 10) || 0;
  var original = ta.getAttribute('data-original') || '';

  function render() {
    var body = smsNormalizeBody(ta.value);
    var text = prefix + body + tail;
    var seg = smsSegments(text);
    var over = (maxTotal && text.length > maxTotal) || (maxBody && body.length > maxBody);
    var empty = body === '';
    if (full) full.textContent = text;
    if (counter) {
      counter.textContent = smsCounterText(text, seg) +
        (over ? ' · Sınır aşıldı, gövdeyi kısaltın' : (empty ? ' · Gövde boş olamaz' : ''));
      counter.classList.toggle('is-over', !!(over || empty));
      counter.classList.toggle('is-multi', !over && !empty && seg.segments > 1);
    }
    ta.classList.toggle('is-invalid', !!(over || empty));
    ta.setAttribute('aria-invalid', over || empty ? 'true' : 'false');
    if (submit && !lockedByServer) submit.disabled = !!(over || empty);
    if (reset) reset.disabled = smsNormalizeBody(ta.value) === smsNormalizeBody(original);
  }

  ta.addEventListener('input', render);
  if (reset) {
    reset.addEventListener('click', function (e) {
      // JS yokken düğme formu ilk değerine döndürür; JS ile her zaman şablondaki orijinal gövde geri gelir
      e.preventDefault();
      ta.value = original;
      render();
      ta.focus();
    });
  }
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

// Hazır hatırlatma kalıpları: tür + başlık + tekrar alanlarını doldurur
(function () {
  var chips = document.querySelectorAll('[data-preset-title]');
  if (!chips.length) return;
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var type = document.getElementById('type');
      var title = document.getElementById('title');
      var repeat = document.getElementById('repeat_days');
      if (type) type.value = c.dataset.presetType;
      if (title) title.value = c.dataset.presetTitle;
      if (repeat) repeat.value = c.dataset.presetRepeat;
      chips.forEach(function (x) { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      var due = document.getElementById('due_date');
      if (due && !due.value) due.focus();
    });
  });
})();

// Menü çekmecesi (geniş ekranda kenar çubuğu sabittir; dar ekranda çekmece olarak açılır)
(function () {
  var body = document.body;
  var nav = document.getElementById('site-nav');
  if (!nav) return;
  var toggles = Array.prototype.slice.call(document.querySelectorAll('.nav-toggle'));
  var wide = window.matchMedia('(min-width: 1024px)');
  var lastToggle = null;

  function isOpen() { return body.classList.contains('nav-open'); }
  function setOpen(open, from) {
    body.classList.toggle('nav-open', open);
    toggles.forEach(function (t) { t.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    if (open) {
      lastToggle = from || null;
      var first = nav.querySelector('.nav-close') || nav.querySelector('a, button');
      if (first) first.focus();
    } else if (lastToggle) {
      lastToggle.focus();
      lastToggle = null;
    }
  }

  toggles.forEach(function (t) {
    t.addEventListener('click', function () { setOpen(!isOpen(), t); });
  });
  document.querySelectorAll('[data-nav-close]').forEach(function (el) {
    el.addEventListener('click', function () { setOpen(false); });
  });
  nav.addEventListener('click', function (e) {
    var t = e.target;
    if (isOpen() && t && typeof t.closest === 'function' && t.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) setOpen(false);
  });
  function syncWidth() { if (wide.matches && isOpen()) setOpen(false); }
  if (typeof wide.addEventListener === 'function') wide.addEventListener('change', syncWidth);
  else if (typeof wide.addListener === 'function') wide.addListener(syncWidth);
})();

// İşlem menüleri (<details class="menu">): dışarı tıklayınca ve Esc ile kapanır; aynı anda tek menü açık
(function () {
  function closeAll(except) {
    document.querySelectorAll('details.menu[open]').forEach(function (d) { if (d !== except) d.removeAttribute('open'); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var inMenu = t && typeof t.closest === 'function' ? t.closest('details.menu') : null;
    closeAll(inMenu);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var open = document.querySelector('details.menu[open]');
    if (!open) return;
    open.removeAttribute('open');
    var s = open.querySelector('summary');
    if (s) s.focus();
  });
})();
