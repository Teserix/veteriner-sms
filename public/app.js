// Küçük yardımcılar: onay isteyen formlar, şablon önizleme, sağlayıcı alanları, menü çekmecesi, işlem menüleri
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (f && f.dataset && f.dataset.confirm) {
    if (!window.confirm(f.dataset.confirm)) e.preventDefault();
  }
});

// SMS-SAYAC-BASLA
// SMS parça hesabı: src/sms/policy.js smsSegments ile birebir aynı (test/sms-counter-parity.test.js doğrular).
// GSM 03.38 temel + genişletme tablosu (2 birim). Türkçe tek kaydırma tablosu (Ğ İ Ş ç ğ ı ş = 2 birim, 155/149)
// yalnızca opts.turkishShift ile (Netgsm); aksi hâlde tabloda olmayan tek karakter mesajı UCS-2'ye geçirir (70/67).
// 2 birimlik karakter (genişletme çifti / vekil çift) parça sınırında bölünmez.
var SMS_LIMITS = { gsm7: { single: 160, multi: 153 }, gsm7tr: { single: 155, multi: 149 }, ucs2: { single: 70, multi: 67 } };
var GSM7_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
var GSM7_EXT = '^{}\\[~]|€';
var GSM7_TR_SHIFT = 'ĞİŞçğış';
function smsSegments(text, opts) {
  var s = String(text == null ? '' : text);
  var turkishShift = !!(opts && opts.turkishShift);
  var encoding = 'gsm7';
  var sizes = [];
  var i, ch;
  // Tablolarda vekil (surrogate) yok: vekil çift UCS-2'ye geçirir, bu yüzden policy.js'teki for...of ile aynı sonuç
  for (i = 0; i < s.length; i++) {
    ch = s.charAt(i);
    if (GSM7_BASIC.indexOf(ch) !== -1) sizes.push(1);
    else if (GSM7_EXT.indexOf(ch) !== -1) sizes.push(2);
    else if (turkishShift && GSM7_TR_SHIFT.indexOf(ch) !== -1) { sizes.push(2); encoding = 'gsm7tr'; }
    else { encoding = 'ucs2'; break; }
  }
  if (encoding === 'ucs2') {
    sizes = [];
    for (i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      var d = s.charCodeAt(i + 1);
      if (c >= 0xD800 && c <= 0xDBFF && d >= 0xDC00 && d <= 0xDFFF) { sizes.push(2); i++; } else sizes.push(1);
    }
  }
  var units = 0;
  for (i = 0; i < sizes.length; i++) units += sizes[i];
  var single = SMS_LIMITS[encoding].single;
  var multi = SMS_LIMITS[encoding].multi;
  if (units === 0) return { encoding: encoding, units: 0, segments: 0, perSegment: single, remainingInSegment: single };
  if (units <= single) return { encoding: encoding, units: units, segments: 1, perSegment: single, remainingInSegment: single - units };
  var segments = 1;
  var used = 0;
  for (i = 0; i < sizes.length; i++) {
    if (used + sizes[i] > multi) { segments += 1; used = 0; }
    used += sizes[i];
  }
  return { encoding: encoding, units: units, segments: segments, perSegment: multi, remainingInSegment: multi - used };
}
// SMS-SAYAC-BITIS

// Gövde, policy.composeMessage gibi normalize edilir: boşluk dizileri tek boşluk, baş/son boşluk atılır
function smsNormalizeBody(body) { return String(body || '').replace(/\s+/g, ' ').trim(); }

// Önizleme ekranındaki sayaç metni (views/reminder_preview.ejs ilk değeriyle aynı biçim)
function smsCounterText(full, seg) {
  return full.length + ' karakter · ' + seg.segments + ' SMS parçası · ' +
    smsEncodingLabel(seg.encoding) + ' · parçada kalan ' + seg.remainingInSegment;
}

// views/reminder_preview.ejs encLabel ile aynı
function smsEncodingLabel(enc) {
  return enc === 'gsm7' ? 'GSM-7' : (enc === 'gsm7tr' ? 'GSM-7 Türkçe' : 'Türkçe (UCS-2)');
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
    var p = smsSegments(t, { turkishShift: out.dataset.trShift === '1' });
    if (len) len.textContent = t.length + ' karakter (kuyruk dahil)';
    if (meter) {
      meter.textContent = p.segments + ' SMS' + ' · SMS başına ' + SMS_LIMITS[p.encoding].single + '/' + SMS_LIMITS[p.encoding].multi + ' karakter' + (p.encoding === 'gsm7' ? '' : ' (Türkçe karakter var)');
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
  var segOpts = { turkishShift: ta.getAttribute('data-tr-shift') === '1' };

  function render() {
    var body = smsNormalizeBody(ta.value);
    var text = prefix + body + tail;
    var seg = smsSegments(text, segOpts);
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
