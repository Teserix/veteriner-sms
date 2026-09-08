# PWA — Uygulama olarak kurulum

Veteriner SMS bir **Progressive Web App**'tir: tarayıcıdan "ana ekrana ekle"
diyerek telefon veya tablette ayrı bir uygulama gibi açılabilir. Adres çubuğu
görünmez, uygulama kendi simgesiyle listelenir.

Uygulama **çevrimdışı çalışmaz** — bu bilinçli bir tercihtir, nedeni aşağıda
"Ne önbelleğe alınır" bölümünde anlatılıyor.

---

## 1. Kurulum

### Android (Chrome / Edge)

1. Kliniğin adresini Chrome'da açın ve giriş yapın.
2. Sayfanın üstünde çıkan **"Ana ekrana ekle"** bandındaki düğmeye dokunun.
   - Bant çıkmadıysa: sağ üstteki **⋮** menüsü → **Uygulamayı yükle** /
     **Ana ekrana ekle**.
3. "Şimdi değil" derseniz bant **30 gün** boyunca tekrar gösterilmez.

Kurulumdan sonra ana ekranda 🐾 simgesiyle **Vet SMS** görünür. Simgeye uzun
basınca kısayollar çıkar: **Hızlı kayıt**, **Hatırlatmalar**, **Hasta Sahipleri**.

### iOS / iPadOS (Safari)

iOS'ta otomatik kurulum penceresi yoktur, adımlar elle yapılır:

1. Adresi **Safari** ile açın (Chrome/Firefox iOS sürümleri ana ekrana ekleyemez).
2. Alttaki **Paylaş** düğmesine (kutudan çıkan ok) dokunun.
3. Listeden **"Ana Ekrana Ekle"**yi seçin, sonra **Ekle**.

Uygulama içindeki bant bu adımları hatırlatır; "Anladım" dediğinizde 30 gün
tekrar görünmez.

### Masaüstü (Chrome / Edge)

Adres çubuğunun sağındaki **yükle** simgesine tıklayın.

---

## 2. HTTPS zorunludur

Service worker ve "ana ekrana ekle" **yalnızca güvenli bağlamda** çalışır:
`https://` ya da geliştirme için `http://localhost`. Şirket içi IP üzerinden
(`http://192.168.1.x`) kurulum **çalışmaz**.

`public/pwa.js` bunu kontrol eder: `window.isSecureContext` yanlışsa service
worker hiç kaydedilmez, uygulama normal web sitesi gibi çalışmaya devam eder.

Kolay HTTPS seçenekleri:

- **Tailscale Funnel** — `tailscale funnel 3000`. Klinik ağına VPN ile bağlı
  cihazlar için en pratik yol; sertifika otomatik.
- **Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:3000`.
  Dışarıya açık, ücretsiz bir alt alan adı verir.
- Kendi alan adınız + Caddy / nginx + Let's Encrypt.

---

## 3. Ne önbelleğe alınır, ne alınmaz

> **Kural: hasta verisi asla cihazda saklanmaz.**

Uygulama çok kiracılıdır ve klinik resepsiyonundaki **ortak bir tablette**
kullanılabilir. Önbellekte kalmış bir hasta listesinin sonraki kullanıcıya
görünmesi kabul edilemez. `public/sw.js` bu yüzden şöyle davranır:

| İstek türü | Davranış |
| --- | --- |
| HTML sayfaları (`request.mode === "navigate"`) | **Yalnızca ağdan.** Önbelleğe hiçbir zaman yazılmaz. |
| `POST` / `PUT` / `DELETE` | Service worker hiç karışmaz, doğrudan tarayıcıya bırakılır. |
| `/api/...` | Önbelleğe alınmaz. |
| `/sw.js`, `/manifest.webmanifest` | Önbelleğe alınmaz (güncellemeler anında yayılsın diye). |
| Başka bir alan adındaki her şey | Önbelleğe alınmaz. |
| `/static/...` (CSS, JS, ikonlar, çevrimdışı sayfası) | **stale-while-revalidate**: önbellekten anında sunulur, arka planda tazelenir. |

Önbellekte tutulan tek şey **uygulama kabuğu**dur: `style.css`, `app.js`,
`pwa.js`, ikonlar ve `offline.html`. Bunların hiçbiri kişisel veri içermez.

### Çevrimdışı davranış

Bağlantı koptuğunda gezinme isteği başarısız olur ve `/static/offline.html`
gösterilir: "İnternet bağlantısı yok — Veteriner SMS çevrimdışı çalışmaz;
hatırlatmalar sunucuda planlanır ve bağlantı gelince gönderilir."

Önemli ayrım: çevrimdışı sayfası **yalnızca gerçek ağ hatasında** gösterilir.
Sunucu HTTP 404 / 500 dönerse bu yanıt olduğu gibi geçirilir, böylece
uygulamanın kendi hata sayfasını görürsünüz.

### Çıkışta önbellek temizliği

Kullanıcı **Çıkış**'a bastığında `pwa.js`, service worker'a `CLEAR_CACHES`
mesajı gönderir ve service worker **tüm** önbellekleri (statik kabuk dahil)
siler. Paylaşılan cihazlar için ek güvence; oturum çerezi zaten sunucu
tarafında geçersiz kılınır.

---

## 4. Sürüm güncelleme akışı

1. `public/sw.js` içindeki `CACHE_VERSION` değerini artırın (`v1` → `v2`).
   Statik varlıkların içeriği değiştiyse bu şart değildir
   (stale-while-revalidate zaten tazeler) ama önbellek yapısı değiştiyse gerekir.
2. Dağıtımdan sonra tarayıcı `/sw.js`'i yeniden ister. Sunucu bu dosyayı
   `Cache-Control: no-cache` ile verdiği için değişiklik hemen fark edilir.
3. Yeni service worker kurulur ve **beklemeye** geçer. `pwa.js` bunu görüp
   sayfanın üstünde **"Yeni sürüm hazır — Yenile"** bandını gösterir.
4. Kullanıcı **Yenile**'ye bastığında service worker'a `SKIP_WAITING` gönderilir,
   `controllerchange` olayında sayfa yeniden yüklenir.
5. `activate` sırasında eski sürüm önbellekleri (`vetsms-static-v1` dışındakiler)
   silinir.

Kullanıcı bandı yok sayarsa güncelleme, uygulamanın tüm sekmeleri kapanıp
yeniden açıldığında kendiliğinden devreye girer.

---

## 5. İkonları yeniden üretme

```sh
node scripts/make-icons.js
```

Betiğin **npm bağımlılığı yoktur**; SVG'yi kendisi üretir, PNG'ye çevirmek için
macOS'un yerleşik `sips` aracını kullanır (bu yüzden yalnızca macOS'ta çalışır).
Betik idempotenttir — istediğiniz kadar çalıştırabilirsiniz.

Üretilenler (`public/icons/`, hepsi depoya dahildir):

| Dosya | Boyut | Kullanım |
| --- | --- | --- |
| `favicon.svg` | vektör | Tarayıcı sekmesi, `/favicon.ico` buraya yönlenir |
| `icon-192.png` | 192×192 | Manifest, `purpose: any` |
| `icon-512.png` | 512×512 | Manifest, `purpose: any` + kısayol ikonları |
| `maskable-512.png` | 512×512 | Manifest, `purpose: maskable` |
| `apple-touch-icon.png` | 180×180 | iOS ana ekran |

Tasarımı değiştirmek için `scripts/make-icons.js` içindeki `TOES` (parmak
yastıkları) ve `PALM` (avuç yastığı) geometrisini düzenleyin. Dikkat edilecekler:

- **maskable** varyantı `scale: 0.78` ile üretilir; içerik merkezdeki %80'lik
  güvenli alanda kalır, böylece Android'in daire/squircle kırpması patiyi kesmez.
- **apple-touch-icon** tam kare ve **tam opak** zeminlidir; köşe yuvarlatmayı
  iOS kendisi yapar, saydamlık bırakılmamalıdır.
- `any` varyantı yuvarlatılmış kare zeminlidir ve kenarlara yakın dolgun durur.

---

## 6. Sunucu tarafı

`src/app.js` içinde, oturum ve CSRF ara katmanlarından **önce** tanımlı
üç rota vardır (giriş yapılmadan da erişilebilir olmalıdır):

| Rota | Başlıklar |
| --- | --- |
| `GET /sw.js` | `Content-Type: application/javascript; charset=utf-8`, `Service-Worker-Allowed: /`, `Cache-Control: no-cache` |
| `GET /manifest.webmanifest` | `Content-Type: application/manifest+json; charset=utf-8`, `Cache-Control: public, max-age=3600` |
| `GET /favicon.ico` | 302 → `/static/icons/favicon.svg` |

Service worker'ın `/` kapsamını yönetebilmesi için `sw.js` **kökten** sunulmak
zorundadır; `/static/sw.js` yeterli olmazdı. Dosya adları koda sabit yazılmıştır,
istekten gelen hiçbir değer yol birleştirmede kullanılmaz.

### CSP

Content-Security-Policy'ye yalnızca iki yönerge eklendi, hiçbir yönerge
gevşetilmedi:

```
worker-src 'self'; manifest-src 'self'
```

`'unsafe-inline'` yoktur ve eklenmemelidir: `pwa.js` içindeki bantlar DOM ile
kurulur, satır içi stil kullanmaz ve yalnızca `public/style.css` içinde zaten
var olan sınıfları (`.warnbox`, `.btn`, `.btn.sm`, `.row`) kullanır.
`public/offline.html` de aynı kurala uyar: satır içi script yoktur, "Yeniden
dene" düğmesi basit bir `<a href="/">` bağlantısıdır.

---

## 7. Sorun giderme

| Belirti | Bakılacak yer |
| --- | --- |
| Kurulum bandı hiç çıkmıyor | HTTPS mi? Uygulama zaten kurulu olabilir. `localStorage`'daki `vetsms.pwa.installDismissedUntil` anahtarını silin. |
| Service worker kaydolmuyor | DevTools → Application → Service Workers. `http://` üzerindeyseniz kayıt bilinçli olarak atlanır. |
| Eski sürüm takılı kaldı | DevTools → Application → Service Workers → **Unregister**, sonra sayfayı yenileyin. |
| Simge güncellenmiyor | Android ana ekran ikonlarını agresif önbelleğe alır; uygulamayı kaldırıp yeniden ekleyin. |
| Manifest okunmuyor | `curl -sI <adres>/manifest.webmanifest` ile `Content-Type: application/manifest+json` başlığını doğrulayın. |
