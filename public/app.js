// Küçük yardımcılar: onay isteyen formlar, şablon önizleme, sağlayıcı alanları
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
