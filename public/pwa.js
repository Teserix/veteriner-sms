/* Veteriner SMS — PWA istemci betiği
 *
 * Görevleri:
 *   1. Service Worker kaydı (yalnızca güvenli bağlamda)
 *   2. "Ana ekrana ekle" kurulum ipucu (Android + iOS yönergesi)
 *   3. "Yeni sürüm hazır" güncelleme bandı
 *   4. Çıkışta service worker önbelleklerini temizletme
 *   5. Standalone modda <html data-standalone="1">
 *
 * CSP çok sıkı: satır içi stil ve satır içi script yok. Bu yüzden bantlar
 * yalnızca public/style.css içinde ZATEN VAR OLAN sınıflarla kurulur:
 * .warnbox, .btn, .btn.sm, .btn.secondary, .row, .row.between, .small, .hidden
 */
(function () {
  'use strict';

  var DISMISS_KEY = 'vetsms.pwa.installDismissedUntil';
  var DISMISS_DAYS = 30;

  /* ---------------- yardımcılar ---------------- */

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* yoksay */ }
    return navigator.standalone === true;
  }

  function isIosSafari() {
    var ua = navigator.userAgent || '';
    var iOS = /iPad|iPhone|iPod/.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!iOS) return false;
    // iOS'ta yalnızca Safari "Ana Ekrana Ekle" sunar.
    return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }

  function dismissedRecently() {
    try {
      var until = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch (e) {
      return false; // localStorage kapalıysa bandı göster
    }
  }

  function rememberDismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
    } catch (e) { /* yoksay */ }
  }

  /**
   * Sayfanın en üstüne bir bant ekler.
   * @param {object} o
   * @param {string} o.text     Bant metni
   * @param {string} o.label    Bandın erişilebilir adı
   * @param {Array}  o.buttons  [{ label, onClick, secondary }]
   * @returns {HTMLElement|null} bant öğesi
   */
  function showBanner(o) {
    var main = document.querySelector('main');
    if (!main) return null;

    var box = document.createElement('div');
    box.className = 'warnbox';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', o.label);
    box.setAttribute('aria-live', 'polite'); // sonradan eklendiği için duyurulsun

    var row = document.createElement('div');
    row.className = 'row between';

    var msg = document.createElement('span');
    msg.textContent = o.text;
    row.appendChild(msg);

    var actions = document.createElement('span');
    actions.className = 'row';
    o.buttons.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = b.secondary ? 'btn sm secondary' : 'btn sm';
      btn.textContent = b.label;
      btn.addEventListener('click', function () { b.onClick(box); });
      actions.appendChild(btn);
    });
    row.appendChild(actions);

    box.appendChild(row);
    main.insertBefore(box, main.firstChild);
    return box;
  }

  function removeBanner(box) {
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  /* ---------------- 5. standalone işareti ---------------- */

  if (isStandalone()) {
    document.documentElement.setAttribute('data-standalone', '1');
  }

  /* ---------------- 2. kurulum ipucu ---------------- */

  var deferredPrompt = null;
  var installBanner = null;

  /** Kurulum bandı yalnızca panelde (ana sayfa) gösterilir; her sayfada tekrarlanması rahatsız edici. */
  function onHomePage() {
    return window.location.pathname === '/';
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();               // tarayıcının kendi mini bandını engelle
    deferredPrompt = e;
    if (!onHomePage() || isStandalone() || dismissedRecently() || installBanner) return;

    installBanner = showBanner({
      label: 'Uygulamayı yükleme önerisi',
      text: 'Uygulamayı ana ekranınıza ekleyebilirsiniz.',
      buttons: [
        {
          label: 'Ana ekrana ekle',
          onClick: function (box) {
            var p = deferredPrompt;
            deferredPrompt = null;
            removeBanner(box);
            installBanner = null;
            if (!p) return;
            p.prompt();
            if (p.userChoice && p.userChoice.then) {
              p.userChoice.then(function (choice) {
                if (choice && choice.outcome !== 'accepted') rememberDismiss();
              }).catch(function () { /* yoksay */ });
            }
          },
        },
        {
          label: 'Şimdi değil',
          secondary: true,
          onClick: function (box) {
            rememberDismiss();
            removeBanner(box);
            installBanner = null;
          },
        },
      ],
    });
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    removeBanner(installBanner);
    installBanner = null;
    rememberDismiss();
  });

  // iOS Safari'de beforeinstallprompt yoktur; yönergeyi elle gösteririz.
  if (onHomePage() && isIosSafari() && !isStandalone() && !dismissedRecently()) {
    document.addEventListener('DOMContentLoaded', function () {
      if (installBanner) return;
      installBanner = showBanner({
        label: 'Uygulamayı yükleme önerisi',
        text: 'Ana ekrana eklemek için: Paylaş \u2192 "Ana Ekrana Ekle".',
        buttons: [
          {
            label: 'Anladım',
            secondary: true,
            onClick: function (box) {
              rememberDismiss();
              removeBanner(box);
              installBanner = null;
            },
          },
        ],
      });
    });
  }

  /* ---------------- 1, 3, 4. service worker ---------------- */

  if (!('serviceWorker' in navigator)) return;

  /** Çıkış formunda: SW'ye tüm önbellekleri sildir (paylaşılan cihaz güvencesi). */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    if (f.getAttribute('action') !== '/cikis') return;
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
      }
    } catch (err) { /* çıkışı engelleme */ }
  });

  if (!window.isSecureContext) return; // http:// üzerinde SW kaydı yapılmaz

  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!reloading) return; // yalnızca biz güncellemeyi tetiklediysek yenile
    reloading = false;
    window.location.reload();
  });

  var updateBanner = null;

  function offerUpdate(waiting) {
    if (!waiting || updateBanner) return;
    updateBanner = showBanner({
      label: 'Uygulama güncellemesi',
      text: 'Yeni sürüm hazır.',
      buttons: [
        {
          label: 'Yenile',
          onClick: function (box) {
            removeBanner(box);
            updateBanner = null;
            reloading = true;
            waiting.postMessage({ type: 'SKIP_WAITING' });
            // controllerchange gelmezse yine de yenile
            window.setTimeout(function () {
              if (reloading) { reloading = false; window.location.reload(); }
            }, 2000);
          },
        },
      ],
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          // controller varsa bu bir GÜNCELLEME'dir, ilk kurulum değil
          if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(sw);
        });
      });
    }).catch(function () { /* kayıt başarısızsa uygulama normal çalışmaya devam eder */ });
  });
})();
